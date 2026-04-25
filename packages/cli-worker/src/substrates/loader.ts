import type { ActionSubstrate } from "@llm-seo-lab/shared";
import type { Substrate, SubstrateFactory } from "./types.ts";

export class SubstrateRegistry {
  private readonly factories = new Map<ActionSubstrate, SubstrateFactory>();

  register(name: ActionSubstrate, factory: SubstrateFactory): void {
    this.factories.set(name, factory);
  }

  has(name: ActionSubstrate): boolean {
    return this.factories.has(name);
  }

  load(name: ActionSubstrate, config: Record<string, unknown>): Substrate {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`unknown substrate: ${name}. Registered: ${[...this.factories.keys()].join(", ") || "(none)"}`);
    }
    return factory(config);
  }

  registered(): ActionSubstrate[] {
    return [...this.factories.keys()];
  }
}
