export type JsonObject = Record<string, unknown>;

export type SocialLinks = Partial<
  Record<"twitch" | "kick" | "youtube" | "discord" | "instagram" | "tiktok", string>
>;
