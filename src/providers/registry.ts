import type { ProviderId } from "../core/types";
import type { ProviderAdapter } from "./types";
import { createZerohongdaeProvider } from "./zerohongdae";
import { createKeyescapeProvider } from "./keyescape";

const providerFactories: Record<ProviderId, () => ProviderAdapter> = {
	zerohongdae: createZerohongdaeProvider,
	keyescape: createKeyescapeProvider,
};

export const getAllProviders = (): ProviderAdapter[] =>
	Object.values(providerFactories).map((factory) => factory());

export const getProvider = (id: ProviderId): ProviderAdapter | undefined =>
	providerFactories[id]?.();

export const getProviderIds = (): ProviderId[] =>
	Object.keys(providerFactories);
