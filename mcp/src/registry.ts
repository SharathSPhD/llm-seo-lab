import type { ToolDescriptor } from "./types.ts";

export class ToolRegistry {
  private tools = new Map<string, ToolDescriptor<unknown, unknown>>();

  register<I, O>(t: ToolDescriptor<I, O>): void {
    if (this.tools.has(t.name)) throw new Error(`duplicate tool: ${t.name}`);
    this.tools.set(t.name, t as unknown as ToolDescriptor<unknown, unknown>);
  }

  get(name: string): ToolDescriptor<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  list(): ToolDescriptor<unknown, unknown>[] {
    return [...this.tools.values()];
  }

  size(): number {
    return this.tools.size;
  }
}
