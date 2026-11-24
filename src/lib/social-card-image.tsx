import { ImageResponse } from 'next/og';

import {
  SOCIAL_CARD_CACHE_CONTROL,
  SOCIAL_CARD_SIZE,
  type SocialCardContent,
} from './social-card';

/**
 * Draws a shared link's preview image.
 *
 * Deliberately plain: a brand background, the card's four lines and nothing
 * else. There is no remote image and no custom font, which keeps the PNG
 * around a few tens of kilobytes (the acceptance budget is 300 kB) and keeps
 * the render independent of the network — a sleeping indexer must not be able
 * to break the preview.
 *
 * Satori (the renderer behind `ImageResponse`) only lays out flexbox, and
 * every element with more than one child needs `display: 'flex'` spelled out,
 * so the styles below are explicit about both.
 */
export function socialCardImage(card: SocialCardContent): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0f766e',
          color: '#ffffff',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            SCI Healthcare
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              padding: '8px 20px',
              borderRadius: 999,
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
            }}
          >
            {card.eyebrow}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              fontSize: card.title.length > 40 ? 64 : 78,
              fontWeight: 700,
              lineHeight: 1.15,
              maxWidth: 1040,
            }}
          >
            {card.title}
          </div>
          <div style={{ display: 'flex', fontSize: 40, opacity: 0.92 }}>
            {card.detail}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 26, opacity: 0.75 }}>
          {card.footer}
        </div>
      </div>
    ),
    {
      ...SOCIAL_CARD_SIZE,
      headers: { 'cache-control': SOCIAL_CARD_CACHE_CONTROL },
    },
  );
}
