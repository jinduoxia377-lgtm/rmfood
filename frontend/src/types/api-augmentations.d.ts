// Type augmentations for APIs with incomplete TypeScript definitions
interface NavigatorConnection {
  effectiveType: string;
  rtt: number;
  downlink: number;
  saveData: boolean;
}

declare global {
  interface Navigator {
    connection?: NavigatorConnection;
  }
}
