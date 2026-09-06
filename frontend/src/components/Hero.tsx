'use client';

import { useEffect, useRef } from 'react';

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // autoplay blocked — hide video, show fallback bg
        if (videoRef.current) {
          videoRef.current.style.display = 'none';
          const hero = videoRef.current.closest('section');
          if (hero) {
            (hero as HTMLElement).style.background =
              'radial-gradient(ellipse at center, rgba(206,255,69,.06) 0%, #121212 70%)';
          }
        }
      });
    }
  }, []);

  return (
    <section className="hero">
      <video ref={videoRef} muted loop playsInline data-anim="fade" data-anim-duration="1500">
        <source src="https://rly.serious.business/wp-content/themes/rly_network/dist/videos/hero.mp4" type="video/mp4" />
      </video>
      <div className="content">
        {/* Left side */}
        <div className="side">
          <svg className="circle" viewBox="0 0 100 100" fill="none">
            <path d="M99.5 50C99.5 77.3377 77.3377 99.5 50 99.5C22.6623 99.5 0.5 77.3377 0.5 50C0.5 22.6623 22.6623 0.5 50 0.5C77.3377 0.5 99.5 22.6623 99.5 50Z" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="infos">
            <div className="item" data-anim="fade-up" data-anim-delay="1100">
              <div className="number">ENSv2</div>
              <div className="desc"><a href="https://ens.domains" target="_blank" rel="noopener noreferrer">Identity &amp; Discovery &rarr;</a></div>
            </div>
            <div className="line" data-anim data-anim-delay="1350"></div>
            <div className="item" data-anim="fade-up" data-anim-delay="1200">
              <div className="number">Graph</div>
              <div className="desc"><a href="https://thegraph.com" target="_blank" rel="noopener noreferrer">Provider Intelligence &rarr;</a></div>
            </div>
          </div>
        </div>

        {/* Center title */}
        <div className="title">
          <p data-anim data-anim-delay="700">ETHOnline 2026 &mdash; Hedera AI &amp; Agentic Payments</p>
          <h2 data-anim="fade" data-anim-duration="1000">
            Agents that discover,<br />evaluate, and<br /><span>pay for themselves.</span>
          </h2>
          <div className="buttons" data-anim="fade" data-anim-delay="800">
            <a className="btn default" href="#architecture">
              <div className="container"><span>Explore Architecture</span></div>
            </a>
            <a className="btn solid" href="#features">
              <div className="container"><span>Explore Features</span></div>
            </a>
          </div>
        </div>

        {/* Right side */}
        <div className="side">
          <svg className="circle" viewBox="0 0 100 100" fill="none">
            <path d="M99.5 50C99.5 77.3377 77.3377 99.5 50 99.5C22.6623 99.5 0.5 77.3377 0.5 50C0.5 22.6623 22.6623 0.5 50 0.5C77.3377 0.5 99.5 22.6623 99.5 50Z" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="infos">
            <div className="item" data-anim="fade-up" data-anim-delay="1100">
              <div className="number">Hedera</div>
              <div className="desc"><a href="https://hedera.com" target="_blank" rel="noopener noreferrer">HBAR Settlement &rarr;</a></div>
            </div>
            <div className="line" data-anim data-anim-delay="1350"></div>
            <div className="item" data-anim="fade-up" data-anim-delay="1200">
              <div className="number">x402</div>
              <div className="desc"><a href="https://x402.org" target="_blank" rel="noopener noreferrer">Machine Payments &rarr;</a></div>
            </div>
          </div>
        </div>
      </div>

      <a className="scroll" href="#features" data-scroll-to>
        <div data-anim data-anim-delay="1500"><span>Scroll for more</span></div>
      </a>
    </section>
  );
}
