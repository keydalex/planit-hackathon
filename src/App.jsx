import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, BarChart3, CheckCircle2,
  ChevronRight, Clock, Image as ImageIcon,
  Layout, PenTool, Sparkles, AlertCircle,
  Wifi, WifiOff, RefreshCw, Trash2, Send, Plus
} from 'lucide-react';
import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────
// Constants & Static Data
// ─────────────────────────────────────────────
const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', color: '#E4405F', short: 'IG' },
  { key: 'telegram',  label: 'Telegram',  color: '#0088cc', short: 'TG' },
  { key: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', short: 'in' },
  { key: 'twitter',   label: 'X (Twitter)', color: '#1DA1F2', short: 'X'  },
  { key: 'facebook',  label: 'Facebook',  color: '#1877F2', short: 'FB' },
  { key: 'tiktok',    label: 'TikTok',    color: '#ff0050', short: 'TK' },
];

const MOCK_METRICS = [
  { id: 1, label: 'Posts Generated', value: '24', change: '+12%', pos: true,  icon: Layout,      color: 'purple' },
  { id: 2, label: 'Engagement Est.', value: '14.2k', change: '+5.4%', pos: true, icon: BarChart3, color: 'blue'  },
  { id: 3, label: 'Time Saved',      value: '6.5h',  change: '+2h',   pos: true, icon: Clock,     color: 'green' },
  { id: 4, label: 'Needs Review',    value: '3',     change: '-2',    pos: false,icon: AlertCircle,color: 'orange'},
];

const DEMO_TEXT = `Q3 Planning Sync – Meeting Notes
Date: April 9, 2026 | Attended: Product, Marketing, Leadership

KEY DECISIONS:
• Shift full focus to AI features throughout Q3.
• Target: increase user retention by 20% via personalization engine.
• Beta rollout to top-100 clients this Friday – strict NDA.
• Big public announcement planned for next week.

ACTION ITEMS:
• PR team: prepare teasers for all social channels.
• Marketing: emphasize innovation, speed, and team dedication.
• Devs: freeze feature requests until retention MVP ships.`;

// ─────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────
function PlatformIcon({ platformKey, size = 32 }) {
  const p = PLATFORMS.find(x => x.key === platformKey) || PLATFORMS[0];
  return (
    <div
      className="preview-platform-icon"
      style={{ background: p.color, width: size, height: size, fontSize: size * 0.28 }}
    >
      {p.short}
    </div>
  );
}

function ConnectionBadge({ connected }) {
  return (
    <div className={`badge ${connected ? 'badge-green' : 'badge-red'}`}
         style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
      {connected ? 'Supabase Live' : 'Offline (Demo mode)'}
    </div>
  );
}

// ─────────────────────────────────────────────
// PostCard
// ─────────────────────────────────────────────
function PostCard({ post, onApprove, onDelete }) {
  const platform = PLATFORMS.find(p => p.key === post.platform) || PLATFORMS[0];
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="social-preview"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <div className="preview-header">
        <PlatformIcon platformKey={post.platform} />
        <div>
          <div className="preview-account-name">{platform.label}</div>
          <div className="preview-account-handle">
            {post.scheduled_at
              ? new Date(post.scheduled_at).toLocaleString('uk-UA')
              : 'Очікує на публікацію'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {post.status === 'approved'
            ? <span className="badge badge-green"><CheckCircle2 size={12} /> Approved</span>
            : <span className="badge badge-orange">Draft</span>}
        </div>
      </div>

      <div className="preview-body">
        <p style={{ whiteSpace: 'pre-line' }}>
          {expanded ? post.content : `${post.content?.slice(0, 200)}${post.content?.length > 200 ? '…' : ''}`}
        </p>
        {post.content?.length > 200 && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, padding: '4px 0' }}
                  onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      <div className="preview-engagement">
        <span>
          <Clock size={12} />
          {new Date(post.created_at).toLocaleString('uk-UA')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {post.status !== 'approved' && (
            <button className="btn btn-sm" style={{ background:'var(--success-bg)', color:'var(--success)', border:'none' }}
                    onClick={() => onApprove(post.id)}>
              <CheckCircle2 size={13} /> Approve
            </button>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(post.id)}>
            <Trash2 size={14} style={{ color: 'var(--error)' }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  // ── State ──
  const [page, setPage]               = useState('generate'); // 'generate' | 'live' | 'calendar'
  const [meetingText, setMeetingText] = useState('');
  const [processing, setProcessing]   = useState(false);
  const [progress, setProgress]       = useState(0);
  const [activeTab, setActiveTab]     = useState('grid');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['instagram','telegram','linkedin','twitter']);

  // ── Supabase live data ──
  const [livePosts, setLivePosts]   = useState([]);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbLoading, setDbLoading]   = useState(true);

  // ── Supabase: initial fetch + real-time subscription ──
  useEffect(() => {
    let channel;

    async function init() {
      setDbLoading(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          setDbConnected(false);
          setLivePosts([{ id: 'err', platform: 'twitter', content: 'SUPABASE ERROR: ' + JSON.stringify(error), status: 'draft', created_at: new Date().toISOString() }]);
          setDbLoading(false);
          return;
        }

        setLivePosts(data || []);
        setDbConnected(true);

        // Real-time listener
        channel = supabase
          .channel(`posts-changes-${Date.now()}`)
          .on('postgres_changes',
              { event: '*', schema: 'public', table: 'posts' },
              (payload) => {
                if (payload.eventType === 'INSERT') {
                  setLivePosts(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                  setLivePosts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
                } else if (payload.eventType === 'DELETE') {
                  setLivePosts(prev => prev.filter(p => p.id !== payload.old.id));
                }
              })
          .subscribe();
      } catch (err) {
        setDbConnected(false);
        setLivePosts([{ id: 'catch', platform: 'twitter', content: 'CATCH ERROR: ' + err.message, status: 'draft', created_at: new Date().toISOString() }]);
      } finally {
        setDbLoading(false);
      }
    }

    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // ── Approve / Delete ──
  async function handleApprove(id) {
    if (dbConnected) {
      await supabase.from('posts').update({ status: 'approved' }).eq('id', id);
    } else {
      setLivePosts(prev => prev.map(p => p.id === id ? { ...p, status: 'approved' } : p));
    }
  }

  async function handleDelete(id) {
    if (dbConnected) {
      await supabase.from('posts').delete().eq('id', id);
    } else {
      setLivePosts(prev => prev.filter(p => p.id !== id));
    }
  }

  // ── Generate (mock flow) ──
  function handleGenerate() {
    if (!meetingText.trim()) return;
    setProcessing(true);
    setProgress(0);

    const steps = [
      { p: 20, msg: 'Parsing meeting context…' },
      { p: 45, msg: 'Extracting key insights…' },
      { p: 70, msg: 'Drafting platform content…' },
      { p: 90, msg: 'Applying brand voice…' },
      { p: 100, msg: 'Finalising content plan…' },
    ];

    steps.forEach((s, i) => {
      setTimeout(() => {
        setProgress(s.p);
        if (i === steps.length - 1) {
          setTimeout(() => {
            setProcessing(false);
            // Push mock posts to local state (or Supabase if connected)
            const newPosts = selectedPlatforms.map((pk, idx) => {
              const p = PLATFORMS.find(x => x.key === pk);
              const post = {
                id: Date.now() + idx,
                platform: pk,
                content: generateMockContent(pk, meetingText),
                status: 'draft',
                created_at: new Date().toISOString(),
                scheduled_at: null,
              };
              if (dbConnected) {
                supabase.from('posts').insert({
                  platform: post.platform,
                  content: post.content,
                  status: post.status,
                }).then(() => {});
              }
              return post;
            });
            if (!dbConnected) {
              setLivePosts(prev => [...newPosts, ...prev]);
            }
            setPage('live');
          }, 600);
        }
      }, (i + 1) * 700);
    });
  }

  function generateMockContent(platform, text) {
    const intro = text.slice(0, 80).trim();
    const templates = {
      instagram: `🚀 Exciting news from our team! ${intro}...\n\nOur Q3 focus is all about AI-powered innovation that delivers real business results. 📊\n\n#Innovation #AI #Tech #Product`,
      telegram:  `🔔 Оновлення команди:\n\n• Фокус на AI-інтеграції у Q3\n• Ціль: +20% retention rate\n• Бета-реліз для топ-100 клієнтів вже цього тижня\n\nПродовжуємо будувати майбутнє! 💪`,
      linkedin:  `Proud to share an important strategic milestone from today's executive sync.\n\n${intro}...\n\nOur commitment to AI-driven innovation is accelerating. We expect a 20% improvement in key retention metrics — and this is just the beginning. 📈\n\n#Leadership #Innovation #FutureOfWork`,
      twitter:   `Big moves this week 🚀 ${intro}... AI focus, 20% retention boost incoming! #BuildInPublic #AI #Tech`,
      facebook:  `We have exciting news to share! 🎉\n\n${intro}...\n\nOur team is working hard on something that will truly make a difference. Stay tuned for the big reveal next week! Like and share if you're excited! 🚀`,
      tiktok:    `POV: Your team just planned the most ambitious AI roadmap ever 👀💻 #Tech #Startup #AI #Innovation`,
    };
    return templates[platform] || `${intro}... #News`;
  }

  // ── Sidebar nav item ──
  function NavItem({ icon: Icon, label, id, badge }) {
    return (
      <div className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
        <Icon className="nav-icon" />
        <span>{label}</span>
        {badge && <div className="nav-badge">{badge}</div>}
      </div>
    );
  }

  const pendingCount = livePosts.filter(p => p.status !== 'approved').length;

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="app-layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Plan<span style={{ color: 'var(--accent-primary)' }}>IT</span></h1>
          <span>AI Content Planner</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Workflow</div>
          <NavItem icon={Sparkles} label="Generate Plan" id="generate" />
          <NavItem icon={Layout}   label="Live Posts"    id="live"     badge={pendingCount || undefined} />
          <NavItem icon={BarChart3} label="Analytics"   id="analytics" />

          <div className="sidebar-section-label" style={{ marginTop: 20 }}>Tools</div>
          <NavItem icon={PenTool} label="Brand Voice" id="voice" />
        </nav>

        <div className="sidebar-footer">
          <ConnectionBadge connected={dbConnected} />
          <div className="sidebar-user" style={{ marginTop: 12 }}>
            <div className="sidebar-avatar">PR</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">PR Lead</div>
              <div className="sidebar-user-role">PlanIT Team</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">

        {/* ══════════ PAGE: GENERATE ══════════ */}
        {page === 'generate' && (
          <motion.div key="gen" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="page-header">
              <div className="page-header-row">
                <div>
                  <h2>Generate Content Plan</h2>
                  <p>Paste meeting minutes → AI creates platform-specific posts automatically.</p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              {MOCK_METRICS.map(m => {
                const Icon = m.icon;
                return (
                  <div className="metric-card" key={m.id}>
                    <div className="metric-header">
                      <div className={`metric-icon ${m.color}`}><Icon size={20} /></div>
                      <div className={`metric-change ${m.pos ? 'positive' : 'negative'}`}>{m.change}</div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="metric-value">{m.value}</div>
                      <div className="metric-label">{m.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input card */}
            <div className="card">
              <h3 style={{ marginBottom: 20, fontSize: '1.1rem' }}>📄 Meeting Minutes</h3>
              <div className="grid-2">
                {/* Drop zone */}
                <div className="upload-zone" onClick={() => setMeetingText(DEMO_TEXT)}>
                  <div className="upload-zone-icon"><Upload size={22} /></div>
                  <h4>Drop file or click for demo</h4>
                  <p>Supports .txt · .pdf · .docx · .mp3</p>
                  <div style={{ marginTop: 14 }}>
                    <span className="badge badge-purple" style={{ cursor: 'pointer' }}>
                      Load demo data ✨
                    </span>
                  </div>
                </div>

                {/* Text area */}
                <div className="input-group">
                  <textarea
                    className="text-input"
                    placeholder="Paste meeting notes here…"
                    value={meetingText}
                    onChange={e => setMeetingText(e.target.value)}
                  />
                </div>
              </div>

              {/* Platform selector */}
              <div style={{ marginTop: 20 }}>
                <div className="input-label" style={{ marginBottom: 10 }}>Target Platforms</div>
                <div className="chip-group">
                  {PLATFORMS.map(p => (
                    <div
                      key={p.key}
                      className={`chip ${selectedPlatforms.includes(p.key) ? 'selected' : ''}`}
                      onClick={() => setSelectedPlatforms(prev =>
                        prev.includes(p.key) ? prev.filter(x => x !== p.key) : [...prev, p.key]
                      )}
                    >
                      <span className={`platform-dot ${p.key}`} style={{ background: p.color }} />
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleGenerate}
                  disabled={!meetingText.trim() || processing || selectedPlatforms.length === 0}
                >
                  {processing ? <RefreshCw size={18} className="spin" /> : <Sparkles size={18} />}
                  {processing ? 'Generating…' : 'Generate Plan'}
                </button>
              </div>

              {/* Progress bar */}
              <AnimatePresence>
                {processing && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginTop: 20 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                        AI processing meeting minutes…
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {progress}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <motion.div
                        className="progress-fill"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      {selectedPlatforms.map((pk, i) => {
                        const done = progress > (i + 1) * (100 / selectedPlatforms.length);
                        return (
                          <span key={pk} className={`badge ${done ? 'badge-green' : 'badge-purple'}`}>
                            {done ? <CheckCircle2 size={11} /> : null}
                            {PLATFORMS.find(p => p.key === pk)?.label}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ══════════ PAGE: LIVE POSTS ══════════ */}
        {page === 'live' && (
          <motion.div key="live" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="page-header">
              <div className="page-header-row">
                <div>
                  <h2>Live Posts</h2>
                  <p>Posts from Zapier arrive here in real-time via Supabase.</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <ConnectionBadge connected={dbConnected} />
                  <div className="tabs">
                    <button className={`tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>Grid</button>
                    <button className={`tab ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>Table</button>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setPage('generate')}>
                    <Plus size={14} /> New Plan
                  </button>
                </div>
              </div>
            </div>

            {dbLoading ? (
              <div className="card ai-processing">
                <div className="ai-spinner" />
                <div className="ai-status-text">
                  <h3>Connecting to Supabase</h3>
                  <p>Loading your posts in real-time…</p>
                </div>
              </div>
            ) : livePosts.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon"><Layout size={32} /></div>
                  <h3>No posts yet</h3>
                  <p>Generate a plan from meeting minutes, or wait for Zapier to deliver posts from Gmail.</p>
                  <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setPage('generate')}>
                    <Sparkles size={16} /> Generate First Plan
                  </button>
                </div>
              </div>
            ) : activeTab === 'grid' ? (
              <div className="preview-grid">
                <AnimatePresence>
                  {livePosts.map(post => (
                    <PostCard key={post.id} post={post} onApprove={handleApprove} onDelete={handleDelete} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="plan-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Content</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {livePosts.map(post => (
                      <tr key={post.id}>
                        <td>
                          <span className={`badge badge-${post.platform}`}>
                            <span className="platform-dot" style={{ background: PLATFORMS.find(p=>p.key===post.platform)?.color }} />
                            {PLATFORMS.find(p => p.key === post.platform)?.label || post.platform}
                          </span>
                        </td>
                        <td>
                          <div className="post-excerpt">{post.content}</div>
                        </td>
                        <td>
                          {post.status === 'approved'
                            ? <span className="badge badge-green"><CheckCircle2 size={11} /> Approved</span>
                            : <span className="badge badge-orange">Draft</span>}
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                          {new Date(post.created_at).toLocaleString('uk-UA')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {post.status !== 'approved' && (
                              <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }}
                                      onClick={() => handleApprove(post.id)}>
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(post.id)}>
                              <Trash2 size={14} style={{ color: 'var(--error)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════ PAGE: ANALYTICS (placeholder) ══════════ */}
        {page === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="page-header">
              <h2>Analytics</h2>
              <p>Post performance and engagement overview.</p>
            </div>
            <div className="metrics-grid">
              {MOCK_METRICS.map(m => {
                const Icon = m.icon;
                return (
                  <div className="metric-card" key={m.id}>
                    <div className="metric-header">
                      <div className={`metric-icon ${m.color}`}><Icon size={20} /></div>
                      <div className={`metric-change ${m.pos ? 'positive' : 'negative'}`}>{m.change}</div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div className="metric-value">{m.value}</div>
                      <div className="metric-label">{m.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid-2" style={{ marginTop: 0 }}>
              {PLATFORMS.slice(0, 4).map(p => (
                <div className="card" key={p.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PlatformIcon platformKey={p.key} size={36} />
                      <span style={{ fontWeight: 600 }}>{p.label}</span>
                    </div>
                    <span className="badge badge-green">+{Math.floor(Math.random() * 20 + 5)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {['Posts', 'Reach', 'Clicks'].map(label => (
                      <div key={label}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                          {Math.floor(Math.random() * 900 + 100)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Demo posts (fallback when Supabase not connected)
// ─────────────────────────────────────────────
const DEMO_POSTS = [
  {
    id: 1, platform: 'instagram',
    content: '🚀 Excited to announce our Q3 roadmap! We are doubling down on AI features to improve user retention by 20%. Stay tuned for the big reveal next week!\n\n#TechNews #Innovation #AI #ProductRoadmap',
    status: 'approved', created_at: new Date(Date.now() - 3600000).toISOString(), scheduled_at: null,
  },
  {
    id: 2, platform: 'telegram',
    content: '🔔 Оновлення команди:\n\n• Фокус на AI-інтеграції у Q3\n• Ціль: +20% retention rate\n• Бета-реліз для топ-100 клієнтів вже цього тижня\n\nПродовжуємо будувати майбутнє! 💪',
    status: 'draft', created_at: new Date(Date.now() - 1800000).toISOString(), scheduled_at: null,
  },
  {
    id: 3, platform: 'linkedin',
    content: 'Proud to share an important strategic milestone from today\'s executive sync. Our commitment to AI-driven innovation is accelerating. We expect a 20% improvement in user retention metrics.\n\n#Leadership #Innovation #FutureOfWork',
    status: 'draft', created_at: new Date(Date.now() - 900000).toISOString(), scheduled_at: null,
  },
  {
    id: 4, platform: 'twitter',
    content: 'Big moves this week 🚀 New AI features targeting 20% retention boost incoming. Ready to disrupt! #BuildInPublic #AI #Tech',
    status: 'draft', created_at: new Date().toISOString(), scheduled_at: null,
  },
];
