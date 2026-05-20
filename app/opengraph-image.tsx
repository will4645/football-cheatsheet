import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import path from 'path';

export const alt = 'Football Cheat Sheets';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const logoData = readFileSync(path.join(process.cwd(), 'public/logo-icon.png'));
  const logoSrc = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080c14',
          gap: '0px',
        }}
      >
        <img src={logoSrc} width={200} height={200} style={{ marginBottom: '28px' }} />
        <div
          style={{
            fontSize: '80px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '0.18em',
            fontFamily: 'sans-serif',
            lineHeight: 1,
            marginBottom: '18px',
          }}
        >
          CHEAT SHEETS
        </div>
        <div
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#4ade80',
            letterSpacing: '0.45em',
            fontFamily: 'sans-serif',
          }}
        >
          KNOW THE GAME.
        </div>
      </div>
    ),
    { ...size },
  );
}
