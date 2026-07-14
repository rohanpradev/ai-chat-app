import type { Serve, Server } from "bun";

interface ServerOptionsInput {
	apiSlug: string;
	fetch: (request: Request) => Response | Promise<Response>;
	port: number;
}

export const configureRequestIdleTimeout = (
	request: Request,
	server: Pick<Server<undefined>, "timeout">,
	apiSlug: string
) => {
	if (new URL(request.url).pathname === `/${apiSlug}/ai/text-stream`) {
		server.timeout(request, 0);
	}
};

export const createServerOptions = ({ apiSlug, fetch, port }: ServerOptionsInput) => {
	return {
		fetch(request, server) {
			configureRequestIdleTimeout(request, server, apiSlug);
			return fetch(request);
		},
		idleTimeout: 185,
		port
	} satisfies Serve.Options<undefined>;
};
