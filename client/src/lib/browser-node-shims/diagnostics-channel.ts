type DiagnosticsChannel = {
  hasSubscribers: boolean;
  publish: (message: unknown) => void;
  subscribe: (listener: (message: unknown) => void) => void;
  unsubscribe: (listener: (message: unknown) => void) => void;
};

const noopChannel: DiagnosticsChannel = {
  hasSubscribers: false,
  publish: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
};

export const channel = () => noopChannel;
export const hasSubscribers = () => false;
export const subscribe = () => {};
export const unsubscribe = () => {};

export default {
  channel,
  hasSubscribers,
  subscribe,
  unsubscribe,
};
