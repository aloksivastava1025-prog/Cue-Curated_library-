import React, { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import { ClerkProvider, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';

function Library() {
  const { allPrompts, loadingDrafts } = useApp();
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewMode, setViewMode] = useState('interactions');
  
  const [userTier, setUserTier] = useState(localStorage.getItem('cue_user_tier') || 'free');
  
  const { isSignedIn, user } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);

  const toggleTier = () => {
    const nextTier = userTier === 'free' ? 'paid' : 'free';
    localStorage.setItem('cue_user_tier', nextTier);
    setUserTier(nextTier);
    window.location.reload();
  };

  const seedDemo = () => {
    window.location.hash = '#/admin';
  };

  // Scroll animations
  const { scrollY } = useScroll();
  const springScroll = useSpring(scrollY, { stiffness: 100, damping: 22, mass: 0.8 });
  const heroScale = useTransform(springScroll, [0, 400], [1, 0.92]);
  const subtitleOpacity = useTransform(springScroll, [0, 300], [1, 0.6]);
  const glowOpacity = useTransform(springScroll, [0, 500], [1, 0.1]);

  // Mouse Parallax for hero title
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 8; // max 4px movement
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const parallaxX = useSpring(mousePos.x, { stiffness: 150, damping: 25 });
  const parallaxY = useSpring(mousePos.y, { stiffness: 150, damping: 25 });

  // Floating particles
  const particles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 5
  }));

  // Title Stagger Animation
  const titleText = "Collection";
  const titleLetters = titleText.split('');

  const letterVariants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' }
  };

  return (
    <>
      <div className="vignette-overlay"></div>
      <div className="film-grain"></div>

      {/* Sticky Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px', background: 'rgba(6,6,6,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: '#232326', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{ background: '#1c1c1e', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '3px', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', display: 'relative', overflow: 'hidden' }}
          >
            Menu
          </motion.button>
          
          <motion.div 
            whileHover={{ letterSpacing: '0.05em', opacity: 0.9 }}
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: 'var(--text)', cursor: 'pointer' }}
          >
            CUE
          </motion.div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
            <motion.div 
              animate={{ opacity: [0.6, 1, 0.6] }} 
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', boxShadow: '0 0 8px var(--electric)' }}
            />
            {allPrompts.length}
          </div>
          
          <motion.button 
            onClick={toggleTier} 
            whileHover={{ scale: 1.02, y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.98 }}
            style={{ background: userTier === 'paid' ? 'rgba(0,0,255,0.15)' : 'var(--card-bg)', color: userTier === 'paid' ? 'var(--electric)' : 'var(--text)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' }}
          >
            View: {userTier === 'paid' ? 'Cue+' : 'Free'}
          </motion.button>
          
          {isAdmin && (
            <a href="#/admin" style={{ fontSize: '12px', color: 'var(--text)', textDecoration: 'none' }}>Admin</a>
          )}
          
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <motion.button 
                whileHover={{ scale: 1.02, y: -2, boxShadow: '0 8px 16px -4px rgba(0,0,255,0.4)', backgroundColor: '#1a1aff' }}
                whileTap={{ scale: 0.98 }}
                style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}
              >
                Join Cue
              </motion.button>
            </SignInButton>
          ) : (
            <UserButton showName appearance={{ elements: { userButtonOuterIdentifier: { color: 'var(--text)', fontSize: '12px' } } }} />
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '100px 32px 60px', overflow: 'hidden', position: 'relative', textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Animated Background Grids & Blobs */}
        <div className="animated-grid-lines">
          <div className="light-sweep"></div>
        </div>

        <motion.div 
          className="title-glow" 
          style={{ opacity: glowOpacity }}
        />

        <motion.div 
          className="ambient-blob" 
          animate={{ x: ['-20%', '20%', '-10%', '-20%'], y: ['-10%', '20%', '10%', '-10%'] }} 
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
          style={{ top: '20%', left: '30%', width: '40vw', height: '40vw', background: 'rgba(0,0,255,0.06)' }}
        />
        
        <motion.div 
          className="ambient-blob" 
          animate={{ x: ['10%', '-30%', '20%', '10%'], y: ['20%', '-10%', '-20%', '20%'] }} 
          transition={{ repeat: Infinity, duration: 35, ease: 'linear' }}
          style={{ top: '40%', right: '20%', width: '35vw', height: '35vw', background: 'rgba(0,100,255,0.04)' }}
        />

        {particles.map(p => (
          <motion.div
            key={p.id}
            animate={{ y: ['-100%', '100%'], x: [0, 20, -20, 0], opacity: [0, 0.08, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', top: `${p.y}%`, left: `${p.x}%`, width: '1.5px', height: '1.5px', background: '#fff', borderRadius: '50%', zIndex: 1, pointerEvents: 'none' }}
          />
        ))}

        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.04)', marginTop: '80px', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }}></div>
        
        <motion.div style={{ position: 'relative', zIndex: 2, scale: heroScale, x: parallaxX, y: parallaxY }}>
          <motion.h1 
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(20px)', y: 40 }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(76px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}
          >
            {titleLetters.map((char, index) => (
              <motion.span 
                key={index} 
                variants={letterVariants}
                initial="hidden" animate="visible"
                transition={{ duration: 0.8, delay: index * 0.015, ease: "easeOut" }}
                style={{ display: 'inline-block' }}
              >
                {char}
              </motion.span>
            ))}
            <motion.sup 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1 }}
              style={{ fontSize: 'clamp(16px, 3vw, 22px)', marginLeft: '8px', top: '-1.5em', fontFamily: 'var(--font-serif)', fontStyle: 'italic', position: 'relative' }}
            >
              {allPrompts.length}
            </motion.sup>
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1, delay: 0.25, ease: "easeOut" }}
            style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)', opacity: subtitleOpacity }}
          >
            New drop <motion.span 
              animate={{ textShadow: ['0 0 10px rgba(0,0,255,0)', '0 0 20px rgba(0,0,255,0.4)', '0 0 10px rgba(0,0,255,0)'] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              style={{ color: 'var(--electric)' }}
            >
              1 day ago
            </motion.span>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
            style={{ margin: '40px auto 0', maxWidth: '520px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.55 }}
          >
            Battle-tested prompts for Bolt, v0, Cursor, and Framer. Stop endlessly tweaking and start shipping. Awwwards-tier interactions saved globally.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8, ease: "easeOut" }}
            style={{ 
              display: 'flex', 
              background: '#ffffff', 
              borderRadius: '4px', 
              padding: '4px', 
              width: 'fit-content', 
              margin: '60px auto -28px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              position: 'relative'
            }}
          >
            <div 
              onClick={() => setViewMode('sections')}
              style={{
                padding: '8px 22px',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                color: viewMode === 'sections' ? '#ffffff' : '#52525b',
                position: 'relative',
                transition: 'color 0.3s ease',
                zIndex: 1
              }}
            >
              {viewMode === 'sections' && (
                <motion.div
                  layoutId="toggleBackground"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ position: 'absolute', inset: 0, background: '#27272a', borderRadius: '4px', zIndex: -1 }}
                />
              )}
              Sections
            </div>
            <div 
              onClick={() => setViewMode('interactions')}
              style={{
                padding: '8px 22px',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                color: viewMode === 'interactions' ? '#ffffff' : '#52525b',
                position: 'relative',
                transition: 'color 0.3s ease',
                zIndex: 1
              }}
            >
              {viewMode === 'interactions' && (
                <motion.div
                  layoutId="toggleBackground"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ position: 'absolute', inset: 0, background: '#27272a', borderRadius: '4px', zIndex: -1 }}
                />
              )}
              Interactions
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Grid Section */}
      <section style={{ padding: '20px 20px 120px', maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', position: 'relative', zIndex: 10 }}>
        {allPrompts.filter(p => (p.componentType || 'interactions') === viewMode).length === 0 && !loadingDrafts ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-dim)', fontWeight: 600 }}>Empty library</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '44px', fontStyle: 'italic', fontWeight: 400, color: 'var(--text)', margin: 0 }}>
              <em style={{ color: 'var(--electric)', fontStyle: 'italic' }}>No {viewMode} found</em>
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.55, margin: 0 }}>Your library has no components of this type. Head to the admin panel to add projects.</p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '14px auto 0' }}>
              <a href="#/admin" style={{ padding: '12px 24px', background: 'var(--electric)', color: '#fff', borderRadius: '3px', textDecoration: 'none', fontSize: '13px', fontWeight: 600, boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)' }}>Open admin &rarr;</a>
              <button onClick={seedDemo} style={{ padding: '12px 24px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>Load 7 demo cards</button>
            </div>
          </div>
        ) : (
          allPrompts.filter(p => (p.componentType || 'interactions') === viewMode).map((item, i) => (
            <EditorialCard key={item.id} item={item} index={i} onClick={setSelectedItem} />
          ))
        )}
      </section>

      {/* Footer */}
      <footer style={{ padding: '60px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '14px', color: 'var(--text-dim)', position: 'relative', zIndex: 10 }}>
        Cue Library &middot; Awwwards-tier interactions for Bolt &middot; v0 &middot; Cursor
      </footer>

      <AnimatePresence>
        {selectedItem && (
          <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function MainApp() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (route === '#/admin') {
    return <Admin />;
  }
  return <Library />;
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
