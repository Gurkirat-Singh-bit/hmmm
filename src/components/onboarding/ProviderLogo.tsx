/**
 * @file ProviderLogo.tsx
 * @description Renders locally bundled SVG marks for onboarding providers.
 * @author Gurkirat Singh
 * @license MIT
 */

import { Image } from "react-native";
import { SvgUri } from "react-native-svg";

const providerLogoSources = {
  claude: require("@/assets/provider-logos/claude.svg"),
  custom: require("@/assets/provider-logos/custom.svg"),
  deepgram: require("@/assets/provider-logos/deepgram.svg"),
  google: require("@/assets/provider-logos/google-gemini.svg"),
  groq: require("@/assets/provider-logos/groq.svg"),
  openai: require("@/assets/provider-logos/openai.svg"),
  openrouter: require("@/assets/provider-logos/openrouter.svg"),
} as const;

export type ProviderLogoId = keyof typeof providerLogoSources;

/** Displays a provider mark from the app bundle without a remote image request. */
export function ProviderLogo({
  providerId,
  size = 17,
}: {
  providerId: ProviderLogoId;
  size?: number;
}) {
  const source = Image.resolveAssetSource(providerLogoSources[providerId]);
  return <SvgUri height={size} uri={source.uri} width={size} />;
}
