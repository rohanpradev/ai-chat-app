import type { FC } from "hono/jsx";
import env from "@/utils/env";

const apiBasePath = `/${env.BASE_API_SLUG}`;

const svgl = {
	bun: "https://svgl.app/library/bun.svg",
	docker: "https://svgl.app/library/docker.svg",
	drizzle: "https://svgl.app/library/drizzle-orm_dark.svg",
	hono: "https://svgl.app/library/hono.svg",
	kubernetes: "https://svgl.app/library/kubernetes.svg",
	openai: "https://svgl.app/library/openai_dark.svg",
	postgresql: "https://svgl.app/library/postgresql.svg",
	redis: "https://svgl.app/library/redis.svg",
	typescript: "https://svgl.app/library/typescript.svg",
	vercel: "https://svgl.app/library/vercel_dark.svg"
} as const;

const endpoints = [
	{ label: "Health", method: "GET", path: "/health", tone: "Probe-ready service status" },
	{ label: "Scalar Docs", method: "GET", path: "/reference", tone: "Interactive API reference" },
	{ label: "OpenAPI", method: "GET", path: "/doc", tone: "Machine-readable contract" },
	{ label: "Session", method: "GET", path: `${apiBasePath}/auth/me`, tone: "Authenticated current user" },
	{ label: "Chat Stream", method: "POST", path: `${apiBasePath}/ai/chat-stream`, tone: "OpenAI + AI SDK streaming" },
	{ label: "Conversations", method: "GET", path: `${apiBasePath}/conversations`, tone: "Saved chat history" }
] as const;

const stack = [
	{ logo: svgl.openai, name: "OpenAI", tone: "model provider" },
	{ logo: svgl.vercel, name: "AI SDK", tone: "typed streaming" },
	{ logo: svgl.hono, name: "Hono", tone: "HTTP runtime" },
	{ logo: svgl.bun, name: "Bun", tone: "server runtime" },
	{ logo: svgl.typescript, name: "TypeScript", tone: "shared contracts" },
	{ logo: svgl.drizzle, name: "Drizzle", tone: "schema-first SQL" },
	{ logo: svgl.postgresql, name: "PostgreSQL", tone: "durable storage" },
	{ logo: svgl.redis, name: "Redis", tone: "fast cache" },
	{ logo: svgl.docker, name: "Docker", tone: "hardened images" },
	{ logo: svgl.kubernetes, name: "Kubernetes", tone: "orchestration" }
] as const;

const stats = [
	{ label: "Runtime", value: "Bun" },
	{ label: "API prefix", value: apiBasePath },
	{ label: "Docs", value: "Scalar" },
	{ label: "Status", value: "Online" }
] as const;

const HomePage: FC = () => {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Chat App Backend</title>
				<style>{`
					:root {
						color-scheme: dark;
						--bg: #06070a;
						--card: rgba(255, 255, 255, 0.08);
						--card-strong: rgba(255, 255, 255, 0.13);
						--line: rgba(255, 255, 255, 0.14);
						--line-strong: rgba(255, 255, 255, 0.24);
						--text: #f8f4ea;
						--muted: #aaa69d;
						--dim: #77736b;
						--accent: #d7ff61;
						--cyan: #7dd3fc;
						--green: #8cffb4;
					}

					* {
						box-sizing: border-box;
					}

					html {
						min-height: 100%;
						background: var(--bg);
					}

					body {
						min-height: 100vh;
						margin: 0;
						overflow-x: hidden;
						background:
							radial-gradient(circle at 14% 8%, rgba(215, 255, 97, 0.18), transparent 28rem),
							radial-gradient(circle at 82% 12%, rgba(125, 211, 252, 0.18), transparent 30rem),
							linear-gradient(140deg, #06070a 0%, #101215 48%, #17120a 100%);
						color: var(--text);
						font-family:
							Inter,
							ui-sans-serif,
							system-ui,
							-apple-system,
							BlinkMacSystemFont,
							"Segoe UI",
							sans-serif;
					}

					a {
						color: inherit;
						text-decoration: none;
					}

					.backdrop-grid {
						position: fixed;
						inset: 0;
						pointer-events: none;
						background-image:
							linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
							linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
						background-size: 48px 48px;
						mask-image: radial-gradient(circle at 50% 20%, black, transparent 72%);
					}

					.shell {
						position: relative;
						width: min(1160px, calc(100% - 32px));
						margin: 0 auto;
						padding: 28px 0 52px;
					}

					.nav {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 16px;
						margin-bottom: 44px;
					}

					.brand {
						display: flex;
						align-items: center;
						gap: 12px;
						font-weight: 800;
						letter-spacing: -0.03em;
					}

					.brand-mark,
					.logo-tile {
						display: grid;
						place-items: center;
						border: 1px solid var(--line);
						background: rgba(255, 255, 255, 0.08);
						box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
					}

					.brand-mark {
						width: 42px;
						height: 42px;
						border-radius: 16px;
					}

					.brand-mark img {
						width: 24px;
						height: 24px;
						object-fit: contain;
					}

					.nav-actions {
						display: flex;
						flex-wrap: wrap;
						gap: 10px;
					}

					.button {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						min-height: 42px;
						padding: 0 16px;
						border: 1px solid var(--line);
						border-radius: 999px;
						background: rgba(255, 255, 255, 0.08);
						color: var(--text);
						font-size: 14px;
						font-weight: 800;
						transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
					}

					.button:hover {
						transform: translateY(-2px);
						border-color: var(--line-strong);
						background: rgba(255, 255, 255, 0.13);
					}

					.button.primary {
						border-color: rgba(215, 255, 97, 0.65);
						background: var(--accent);
						color: #11140b;
					}

					.hero {
						display: grid;
						grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
						gap: 24px;
						align-items: stretch;
					}

					.panel {
						border: 1px solid var(--line);
						border-radius: 32px;
						background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.055));
						box-shadow: 0 24px 90px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.1);
						backdrop-filter: blur(18px);
					}

					.hero-main {
						position: relative;
						overflow: hidden;
						padding: clamp(28px, 5vw, 58px);
					}

					.hero-main:after {
						position: absolute;
						right: -90px;
						bottom: -120px;
						width: 320px;
						height: 320px;
						content: "";
						border-radius: 999px;
						background: radial-gradient(circle, rgba(215, 255, 97, 0.26), transparent 68%);
					}

					.kicker {
						display: inline-flex;
						align-items: center;
						gap: 10px;
						margin-bottom: 28px;
						padding: 9px 12px;
						border: 1px solid rgba(215, 255, 97, 0.28);
						border-radius: 999px;
						background: rgba(215, 255, 97, 0.08);
						color: var(--accent);
						font-size: 12px;
						font-weight: 900;
						letter-spacing: 0.18em;
						text-transform: uppercase;
					}

					.pulse {
						width: 8px;
						height: 8px;
						border-radius: 999px;
						background: var(--accent);
						box-shadow: 0 0 0 8px rgba(215, 255, 97, 0.12);
					}

					h1 {
						max-width: 780px;
						margin: 0;
						font-size: clamp(46px, 7vw, 92px);
						line-height: 0.92;
						letter-spacing: -0.075em;
					}

					.lede {
						max-width: 640px;
						margin: 24px 0 0;
						color: var(--muted);
						font-size: clamp(17px, 2vw, 21px);
						line-height: 1.65;
					}

					.hero-actions {
						display: flex;
						flex-wrap: wrap;
						gap: 12px;
						margin-top: 32px;
					}

					.stats {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 10px;
						margin-top: 36px;
					}

					.stat {
						padding: 14px;
						border: 1px solid var(--line);
						border-radius: 18px;
						background: rgba(0, 0, 0, 0.22);
					}

					.stat span {
						display: block;
						color: var(--dim);
						font-size: 11px;
						font-weight: 900;
						letter-spacing: 0.14em;
						text-transform: uppercase;
					}

					.stat strong {
						display: block;
						margin-top: 7px;
						font-size: 15px;
					}

					.console {
						display: flex;
						flex-direction: column;
						min-height: 100%;
						overflow: hidden;
					}

					.console-head {
						display: flex;
						align-items: center;
						justify-content: space-between;
						padding: 18px 20px;
						border-bottom: 1px solid var(--line);
					}

					.dots {
						display: flex;
						gap: 7px;
					}

					.dots i {
						width: 10px;
						height: 10px;
						border-radius: 999px;
						background: var(--line-strong);
					}

					.console-body {
						display: grid;
						gap: 12px;
						padding: 18px;
					}

					.endpoint {
						display: grid;
						grid-template-columns: 62px minmax(0, 1fr);
						gap: 12px;
						align-items: center;
						padding: 14px;
						border: 1px solid rgba(255, 255, 255, 0.1);
						border-radius: 20px;
						background: rgba(0, 0, 0, 0.2);
					}

					.method {
						display: inline-flex;
						justify-content: center;
						padding: 6px 0;
						border-radius: 999px;
						background: rgba(125, 211, 252, 0.12);
						color: var(--cyan);
						font-size: 12px;
						font-weight: 900;
					}

					.endpoint strong {
						display: block;
						overflow: hidden;
						font-family: "SFMono-Regular", Consolas, monospace;
						font-size: 13px;
						text-overflow: ellipsis;
						white-space: nowrap;
					}

					.endpoint span {
						display: block;
						margin-top: 5px;
						color: var(--muted);
						font-size: 13px;
					}

					.section {
						margin-top: 24px;
					}

					.section-title {
						display: flex;
						align-items: end;
						justify-content: space-between;
						gap: 16px;
						margin: 0 0 14px;
					}

					.section-title h2 {
						margin: 0;
						font-size: clamp(26px, 4vw, 42px);
						letter-spacing: -0.04em;
					}

					.section-title p {
						max-width: 460px;
						margin: 0;
						color: var(--muted);
						line-height: 1.6;
					}

					.stack {
						display: grid;
						grid-template-columns: repeat(5, minmax(0, 1fr));
						gap: 12px;
					}

					.stack-card {
						padding: 16px;
						border: 1px solid var(--line);
						border-radius: 24px;
						background: rgba(255, 255, 255, 0.07);
					}

					.logo-tile {
						width: 46px;
						height: 46px;
						margin-bottom: 22px;
						border-radius: 18px;
					}

					.logo-tile img {
						width: 26px;
						height: 26px;
						object-fit: contain;
					}

					.stack-card strong {
						display: block;
						font-size: 16px;
					}

					.stack-card span {
						display: block;
						margin-top: 6px;
						color: var(--muted);
						font-size: 13px;
					}

					.footer {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 12px;
						margin-top: 24px;
						padding: 18px 20px;
						border: 1px solid var(--line);
						border-radius: 24px;
						background: rgba(0, 0, 0, 0.18);
						color: var(--muted);
						font-size: 13px;
					}

					.footer code {
						color: var(--text);
					}

					@media (max-width: 920px) {
						.nav,
						.section-title,
						.footer {
							align-items: flex-start;
							flex-direction: column;
						}

						.hero {
							grid-template-columns: 1fr;
						}

						.stats {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}

						.stack {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}
					}

					@media (max-width: 560px) {
						.shell {
							width: min(100% - 20px, 1160px);
							padding-top: 16px;
						}

						.hero-main {
							padding: 24px;
						}

						.stats,
						.stack {
							grid-template-columns: 1fr;
						}

						.endpoint {
							grid-template-columns: 1fr;
						}
					}
				`}</style>
			</head>
			<body>
				<div class="backdrop-grid" />
				<main class="shell">
					<nav class="nav" aria-label="Backend navigation">
						<div class="brand">
							<span class="brand-mark">
								<img src={svgl.openai} alt="OpenAI" loading="eager" />
							</span>
							<span>Chat App Backend</span>
						</div>
						<div class="nav-actions">
							<a class="button" href="/doc">
								OpenAPI JSON
							</a>
							<a class="button primary" href="/reference">
								Scalar Docs
							</a>
						</div>
					</nav>

					<section class="hero">
						<div class="panel hero-main">
							<div class="kicker">
								<span class="pulse" />
								OpenAI-ready API
							</div>
							<h1>Backend control plane for streaming AI chat.</h1>
							<p class="lede">
								A Hono API running on Bun with typed contracts, Drizzle persistence, OpenAI model access, and AI SDK streaming
								endpoints for the React client.
							</p>
							<div class="hero-actions">
								<a class="button primary" href="/reference">
									Explore API docs
								</a>
								<a class="button" href="/health">
									Check health
								</a>
							</div>
							<div class="stats">
								{stats.map((stat) => (
									<div class="stat" key={stat.label}>
										<span>{stat.label}</span>
										<strong>{stat.value}</strong>
									</div>
								))}
							</div>
						</div>

						<aside class="panel console" aria-label="Backend endpoint summary">
							<div class="console-head">
								<strong>Routes</strong>
								<div class="dots" aria-hidden="true">
									<i />
									<i />
									<i />
								</div>
							</div>
							<div class="console-body">
								{endpoints.map((endpoint) => (
									<a class="endpoint" href={endpoint.path} key={endpoint.path}>
										<span class="method">{endpoint.method}</span>
										<span>
											<strong>{endpoint.path}</strong>
											<span>{endpoint.tone}</span>
										</span>
									</a>
								))}
							</div>
						</aside>
					</section>

					<section class="section">
						<div class="section-title">
							<h2>Built with the production stack.</h2>
							<p>
								SVGL-hosted logos keep this backend index aligned with the real services and libraries used by the application.
							</p>
						</div>
						<div class="stack">
							{stack.map((item) => (
								<div class="stack-card" key={item.name}>
									<div class="logo-tile">
										<img src={item.logo} alt={item.name} loading="lazy" />
									</div>
									<strong>{item.name}</strong>
									<span>{item.tone}</span>
								</div>
							))}
						</div>
					</section>

					<footer class="footer">
						<span>
							Backend index route: <code>GET /</code>
						</span>
						<span>
							API prefix: <code>{apiBasePath}</code>
						</span>
					</footer>
				</main>
			</body>
		</html>
	);
};

export default HomePage;
