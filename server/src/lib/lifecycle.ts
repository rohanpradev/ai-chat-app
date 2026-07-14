let shuttingDown = false;

export const beginShutdown = () => {
	shuttingDown = true;
};

export const isShuttingDown = () => shuttingDown;

export const resetLifecycleForTests = () => {
	shuttingDown = false;
};
