// Simple spinner implementation to replace ora
export class SimpleSpinner {
  private message: string;
  private interval: NodeJS.Timeout | null = null;
  private frames = ["-", "\\", "|", "/"];
  private frameIndex = 0;
  private startTime: number;
  private updateTimeFn: (() => string) | null = null;

  constructor(message: string, updateTimeFn?: () => string) {
    this.message = message;
    this.startTime = Date.now();
    this.updateTimeFn = updateTimeFn || null;
  }

  start(): SimpleSpinner {
    this.interval = setInterval(() => {
      // If we have a time update function, use it to get the latest formatted time
      if (this.updateTimeFn) {
        const timeStr = this.updateTimeFn();
        // Find and replace the time section [x.xs] in the message
        const updatedMessage = this.message.replace(/\[\d+\.\d+s\]/, timeStr);
        process.stdout.write(
          `\r${this.frames[this.frameIndex]} ${updatedMessage}`
        );
      } else {
        process.stdout.write(
          `\r${this.frames[this.frameIndex]} ${this.message}`
        );
      }
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 100);
    return this;
  }

  set text(message: string) {
    this.message = message;
  }

  succeed(message?: string): void {
    this.stop();
    console.log(`\r✓ ${message || this.message}`);
  }

  fail(message?: string): void {
    this.stop();
    console.log(`\r✗ ${message || this.message}`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write(
      "\r                                                     \r"
    );
  }
}
