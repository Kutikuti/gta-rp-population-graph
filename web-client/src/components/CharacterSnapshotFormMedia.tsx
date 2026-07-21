import { useEffect, useState } from "react";

import type { CharacterSnapshot, PublicStreamer } from "../api";
import addIconUrl from "../assets/misc/add.svg";

const textValue = (value: string | null) => value ?? "";

const nullableValue = (value: string) => {
  return value.length ? value : null;
};

const socialPlatforms = [
  ["twitch", "Twitch"],
  ["kick", "Kick"],
  ["youtube", "YouTube"],
  ["discord", "Discord"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"]
] as const;

type CharacterSnapshotFormMediaProps = {
  snapshot: CharacterSnapshot;
  streamers: PublicStreamer[];
  onChange: (changes: Partial<CharacterSnapshot>) => void;
};

export function CharacterSnapshotFormMedia({
  snapshot,
  streamers,
  onChange
}: CharacterSnapshotFormMediaProps) {
  const [isNewStreamerOpen, setIsNewStreamerOpen] = useState(Boolean(snapshot.streamerName));
  const selectedStreamer = snapshot.streamerId
    ? (streamers.find((streamer) => streamer.id === snapshot.streamerId) ?? null)
    : null;
  const areSocialLinksEditable = Boolean(snapshot.streamerId || isNewStreamerOpen);

  const updateSocialLink = (
    platform: keyof NonNullable<CharacterSnapshot["socialLinks"]>,
    value: string
  ) => {
    const nextValue = nullableValue(value);
    const nextLinks = {
      ...(snapshot.socialLinks ?? {})
    };

    if (nextValue) {
      nextLinks[platform] = nextValue;
    } else {
      delete nextLinks[platform];
    }

    onChange({
      socialLinks: Object.keys(nextLinks).length ? nextLinks : null
    });
  };
  const selectExistingStreamer = (streamerId: string | null) => {
    if (!streamerId) {
      onChange({
        streamerId: null,
        streamerName: null,
        socialLinks: null
      });
      setIsNewStreamerOpen(false);
      return;
    }

    const streamer = streamers.find((item) => item.id === streamerId) ?? null;

    onChange({
      streamerId,
      streamerName: null,
      socialLinks: streamer?.socialLinks ?? null
    });
    setIsNewStreamerOpen(false);
  };

  useEffect(() => {
    if (snapshot.streamerName && !isNewStreamerOpen) {
      setIsNewStreamerOpen(true);
      return;
    }

    if (!snapshot.streamerName && snapshot.streamerId && isNewStreamerOpen) {
      setIsNewStreamerOpen(false);
    }
  }, [isNewStreamerOpen, snapshot.streamerId, snapshot.streamerName]);

  return (
    <fieldset>
      <legend>Médias</legend>
      <div className="form-grid media-grid">
        <div className="media-streamer-row">
          <label className="media-streamer-field">
            <span>Streamer existant</span>
            <select
              value={snapshot.streamerId ?? ""}
              onChange={(event) => {
                selectExistingStreamer(nullableValue(event.target.value));
              }}
            >
              <option value="">Aucun streamer</option>
              {streamers.map((streamer) => (
                <option key={streamer.id} value={streamer.id}>
                  {streamer.publicName}
                </option>
              ))}
            </select>
          </label>
          {!isNewStreamerOpen ? (
            <button
              type="button"
              className="add-row-button media-streamer-toggle"
              aria-label="Ajouter un streamer"
              title="Ajouter un streamer"
              onClick={() => {
                setIsNewStreamerOpen(true);
                onChange({
                  streamerId: null,
                  streamerName: null,
                  socialLinks: null
                });
              }}
            >
              <img src={addIconUrl} alt="" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {isNewStreamerOpen ? (
          <div className="media-streamer-create-row">
            <label className="media-streamer-create-field">
              <span>Nouveau streamer</span>
              <input
                type="text"
                value={textValue(snapshot.streamerName)}
                placeholder="Nom public"
                onChange={(event) => {
                  onChange({
                    streamerId: null,
                    streamerName: nullableValue(event.target.value)
                  });
                }}
              />
            </label>
            <div className="media-streamer-create-action">
              <span aria-hidden="true" className="media-streamer-action-spacer" />
              <button
                type="button"
                className="ghost-button compact-action media-streamer-cancel"
                onClick={() => {
                  setIsNewStreamerOpen(false);
                  onChange({
                    streamerName: null,
                    socialLinks: selectedStreamer?.socialLinks ?? null
                  });
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : null}
        {socialPlatforms.map(([platform, label]) => (
          <label key={platform}>
            <span>{label}</span>
            <input
              type="text"
              value={textValue(snapshot.socialLinks?.[platform] ?? null)}
              placeholder={
                areSocialLinksEditable ? `Lien ${label}` : "Sélectionner ou créer un streamer"
              }
              disabled={!areSocialLinksEditable}
              onChange={(event) => {
                updateSocialLink(platform, event.target.value);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
