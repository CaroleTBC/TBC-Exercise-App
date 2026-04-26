import React, { useState } from 'react';
import { Play } from 'lucide-react';

function getEmbedUrl(url, type) {
  if (!url) return null;

  if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    let id = '';
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) {
        id = u.pathname.slice(1);
      } else {
        id = u.searchParams.get('v');
      }
    } catch {
      const match = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
      id = match ? match[1] : '';
    }
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null;
  }

  if (type === 'vimeo' || url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    const id = match ? match[1] : '';
    return id ? `https://player.vimeo.com/video/${id}?byline=0&portrait=0&title=0` : null;
  }

  return url;
}

export default function VideoPlayer({ url, type, title }) {
  const [loaded, setLoaded] = useState(false);
  const [activated, setActivated] = useState(false);
  const embedUrl = getEmbedUrl(url, type);

  if (!url || !embedUrl) return null;

  // Thumbnail for YouTube (performance: lazy load iframe)
  const isYoutube = type === 'youtube' || url.includes('youtube') || url.includes('youtu.be');
  let thumbId = '';
  if (isYoutube) {
    try {
      const u = new URL(url);
      thumbId = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v');
    } catch {
      const m = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
      thumbId = m ? m[1] : '';
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.aspectBox}>
        {!activated && isYoutube && thumbId ? (
          <button
            style={styles.thumbnail}
            onClick={() => setActivated(true)}
            aria-label={`Play ${title || 'video'}`}
          >
            <img
              src={`https://img.youtube.com/vi/${thumbId}/hqdefault.jpg`}
              alt={title || 'Video thumbnail'}
              style={styles.thumbImg}
              loading="lazy"
            />
            <div style={styles.playOverlay}>
              <div style={styles.playBtn}>
                <Play size={28} color="white" fill="white" />
              </div>
            </div>
          </button>
        ) : (
          <>
            {!loaded && (
              <div style={styles.loadingPlaceholder}>
                <span className="spinner" />
              </div>
            )}
            <iframe
              src={embedUrl}
              title={title || 'Exercise video'}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                ...styles.iframe,
                opacity: loaded ? 1 : 0,
              }}
              onLoad={() => setLoaded(true)}
            />
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: '#000',
    marginBottom: '1rem',
  },
  aspectBox: {
    position: 'relative',
    paddingBottom: '56.25%', // 16:9 default
    height: 0,
    overflow: 'hidden',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    transition: 'opacity 0.3s',
  },
  loadingPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
  },
  thumbnail: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    background: '#000',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.85,
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(47,69,111,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s, background 0.2s',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
};
