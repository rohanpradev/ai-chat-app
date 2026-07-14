import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { users } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import { invalidateCache } from "@/middlewares/redis-cache-middleware";
import type { UpdateUserProfileRoute, UserProfileRoute } from "@/routes/profile/profile.route";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

const validateProfileImage = (profileImage: File) => {
	if (!ALLOWED_PROFILE_IMAGE_TYPES.has(profileImage.type)) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: "Profile image must be a GIF, JPEG, PNG, or WebP file"
		});
	}

	if (profileImage.size <= 0 || profileImage.size > MAX_PROFILE_IMAGE_BYTES) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: "Profile image must be smaller than 5MB"
		});
	}
};

const fileToDataUrl = async (profileImage: File) => {
	const buffer = await profileImage.arrayBuffer();
	return `data:${profileImage.type};base64,${Buffer.from(buffer).toString("base64")}`;
};

export const userProfile: AppRouteHandler<UserProfileRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const user = await db.query.users.findFirst({
		where: (userDb, { eq }) => eq(userDb.id, userJwt.id)
	});

	if (!user)
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
			message: "User not found"
		});

	return c.json(
		{
			data: {
				createdAt: user.createdAt.toISOString(),
				email: user.email,
				emailVerified: user.emailVerified,
				id: user.id,
				name: user.name,
				profileImage: user.image,
				updatedAt: user.updatedAt.toISOString()
			},
			message: "User profile retrieved successfully"
		},
		HttpStatusCodes.OK
	);
};

export const patchUserProfile: AppRouteHandler<UpdateUserProfileRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const user = await db.query.users.findFirst({
		where: (userDb, { eq }) => eq(userDb.id, userJwt.id)
	});

	if (!user)
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
			message: "User not found"
		});

	const { name, profileImage, removeProfileImage } = c.req.valid("form");

	if (profileImage && removeProfileImage === "true") {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: "Choose a new profile image or remove the current image, not both"
		});
	}

	const updatedData: { name: string; image?: string | null } = {
		name
	};

	if (profileImage) {
		validateProfileImage(profileImage);
		updatedData.image = await fileToDataUrl(profileImage);
	} else if (removeProfileImage === "true") {
		updatedData.image = null;
	}

	const [updatedUser] = await db.update(users).set(updatedData).where(eq(users.id, user.id)).returning({
		createdAt: users.createdAt,
		email: users.email,
		emailVerified: users.emailVerified,
		id: users.id,
		name: users.name,
		profileImage: users.image,
		updatedAt: users.updatedAt
	});

	if (!updatedUser) {
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
			message: "User not found"
		});
	}

	await invalidateCache.byUser(user.id);

	return c.json(
		{
			data: {
				...updatedUser,
				createdAt: updatedUser.createdAt.toISOString(),
				updatedAt: updatedUser.updatedAt.toISOString()
			},
			message: "User profile updated successfully"
		},
		HttpStatusCodes.OK
	);
};
