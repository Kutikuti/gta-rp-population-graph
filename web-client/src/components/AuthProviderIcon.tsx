import discordIcon from "../assets/brands/discord.png";
import googleIcon from "../assets/brands/google.png";
import twitchIcon from "../assets/brands/twitch.png";

export type AuthProvider = "google" | "discord" | "twitch";

const providerIcons: Record<AuthProvider, { src: string; alt: string }> = {
  google: { src: googleIcon, alt: "Google" },
  discord: { src: discordIcon, alt: "Discord" },
  twitch: { src: twitchIcon, alt: "Twitch" }
};

type AuthProviderIconProps = {
  provider: AuthProvider;
  className?: string;
};

export function AuthProviderIcon({ provider, className }: AuthProviderIconProps) {
  const icon = providerIcons[provider];

  return <img src={icon.src} alt="" aria-hidden="true" className={className} />;
}

export const authProviderLabels: Record<AuthProvider, string> = {
  google: "Google",
  discord: "Discord",
  twitch: "Twitch"
};
