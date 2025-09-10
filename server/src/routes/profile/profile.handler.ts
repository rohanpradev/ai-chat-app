import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "@/db";
import type { AppRouteHandler } from "@/lib/types";
import type { UserProfileRoute } from "@/routes/profile/profile.route";

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
