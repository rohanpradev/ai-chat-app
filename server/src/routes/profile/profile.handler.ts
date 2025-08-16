import { join } from "node:path";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import db from "@/db";
import { users } from "@/db/schema";
import type { AppRouteHandler } from "@/lib/types";
import type { UpdateUserProfileRoute, UserProfileRoute } from "@/routes/profile/profile.route";

export const userProfile: AppRouteHandler<UserProfileRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const user = await db.query.users.findFirst({
		columns: { password: false },
		where: (userDb, { eq }) => eq(userDb.id, userJwt.id)
	});

	if (!user)
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
			message: "User not found"
		});

	return c.json(
		{
			data: user,
			message: "User profile retrieved successfully"
		},
		HttpStatusCodes.OK
	);
};

export const patchUserProfile: AppRouteHandler<UpdateUserProfileRoute> = async (c) => {
	const userJwt = c.get("jwtPayload").sub;
	const user = await db.query.users.findFirst({
		columns: { password: false },
		where: (userDb, { eq }) => eq(userDb.id, userJwt.id)
	});

	if (!user)
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, {
			message: "User not found"
		});

	const { name, profileImage = null } = c.req.valid("form");

	const updatedData: { name: string; profileImage?: string } = {
		name
	};

	if (profileImage) {
		updatedData.profileImage = profileImage.name;
		const filePath = join(import.meta.dir, "..", "..", "storage", profileImage.name);
		await Bun.write(filePath, profileImage);
	}

	const [updatedUser] = await db.update(users).set(updatedData).where(eq(users.id, user.id)).returning({
		email: users.email,
		id: users.id,
		name: users.name,
		profileImage: users.profileImage
	});

	return c.json(
		{
			data: updatedUser,
			message: "User profile updated successfully"
		},
		HttpStatusCodes.OK
	);
};
