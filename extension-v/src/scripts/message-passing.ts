export function sendSignal(
  request: RequestMessage,
  destination: string,
  options: OptionsMessage = { toTab: false, tabID: 0 }
) {
  request.destination = destination;
  request.responding = false;
  return options.toTab
    ? chrome.tabs.sendMessage(options.tabID, request)
    : chrome.runtime.sendMessage(request);
}

export async function recibeResponse(
  request: RequestMessage,
  destination: string,
  options: OptionsMessage = {
    toTab: false,
    tabID: 0,
  }
) {
  request.destination = destination;
  request.responding = true;
  if (!options.toTab) {
    try {
      const response = await chrome.runtime.sendMessage(request);
      return response;
    } catch (error: any) {
      throw new Error(`Cannot receive response from ${destination}: ${error.message}`);
    }
  } else {
    try {
      const response = await chrome.tabs.sendMessage(options.tabID, request);
      return response;
    } catch (error: any) {
      throw new Error(`Cannot receive response from tab ${destination}: ${error.message}`);
    }
  }
}

export function setListener(name: string, handlers: EventHandlers) {
  chrome.runtime.onMessage.addListener(
    (message: RequestMessageTotal, sender, sendResponse): boolean | undefined => {
      if (message.destination === name) {
        handle(message, sendResponse);
        return message.responding;
      }
    }
  );

  async function handle(
    message: RequestMessageTotal,
    sendResponse: (...args: any) => void
  ): Promise<void> {
    const handler = handlers[message.method];
    if (!handler) throw new Error(`No handler for ${message.method}`);
    if (!message.responding) {
      handler(...message.args);
    } else {
      sendResponse(await handler(...message.args));
    }
  }
}

export function createMessage(method: string, ...args: any[]) {
  return { method, args };
}

type RequestMessage = {
  method: string;
  args: any[];
  destination?: string;
  responding?: boolean;
};

type RequestMessageTotal = Required<Pick<RequestMessage, keyof RequestMessage>>;

type OptionsMessage = {
  toTab: boolean;
  tabID: number;
};

export type EventHandlers = {
  [event: string]: (...args: any[]) => any;
};
