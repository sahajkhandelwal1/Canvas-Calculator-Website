import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './BounceCards.css';

export default function BounceCards({
  className = '',
  cards = [],
  containerWidth = 400,
  containerHeight = 400,
  animationDelay = 0.5,
  animationStagger = 0.06,
  easeType = 'elastic.out(1, 0.8)',
  transformStyles = [
    'rotate(10deg) translate(-170px)',
    'rotate(5deg) translate(-85px)',
    'rotate(-3deg)',
    'rotate(-10deg) translate(85px)',
    'rotate(2deg) translate(170px)'
  ],
  enableHover = true,
  onCardClick = () => {}
}) {
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate once on initial mount
    if (!hasAnimated.current) {
      gsap.fromTo('.bounce-card',
        { scale: 0 },
        {
          scale: 1,
          stagger: animationStagger,
          ease: easeType,
          delay: animationDelay
        }
      );
      hasAnimated.current = true;
    }
  }, []); // Empty dependency array - only run once

  const getNoRotationTransform = (transformStr) => {
    const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
    if (hasRotate) {
      return transformStr.replace(/rotate\([\s\S]*?\)/, 'rotate(0deg)');
    } else if (transformStr === 'none') {
      return 'rotate(0deg)';
    } else {
      return `${transformStr} rotate(0deg)`;
    }
  };

  const getPushedTransform = (baseTransform, offsetX) => {
    const translateRegex = /translate\(([-0-9.]+)px\)/;
    const match = baseTransform.match(translateRegex);
    if (match) {
      const currentX = parseFloat(match[1]);
      const newX = currentX + offsetX;
      return baseTransform.replace(translateRegex, `translate(${newX}px)`);
    } else {
      return baseTransform === 'none' ? `translate(${offsetX}px)` : `${baseTransform} translate(${offsetX}px)`;
    }
  };

  const pushSiblings = (hoveredIdx) => {
    if (!enableHover) return;
    
    cards.forEach((_, i) => {
      gsap.killTweensOf(`.bounce-card-${i}`);
      const baseTransform = transformStyles[i] || 'none';
      
      if (i === hoveredIdx) {
        const noRotation = getNoRotationTransform(baseTransform);
        gsap.to(`.bounce-card-${i}`, {
          transform: noRotation,
          duration: 0.4,
          ease: 'back.out(1.4)',
          overwrite: 'auto'
        });
      } else {
        const offsetX = i < hoveredIdx ? -160 : 160;
        const pushedTransform = getPushedTransform(baseTransform, offsetX);
        const distance = Math.abs(hoveredIdx - i);
        const delay = distance * 0.05;
        gsap.to(`.bounce-card-${i}`, {
          transform: pushedTransform,
          duration: 0.4,
          ease: 'back.out(1.4)',
          delay,
          overwrite: 'auto'
        });
      }
    });
  };

  const resetSiblings = () => {
    if (!enableHover) return;
    
    cards.forEach((_, i) => {
      gsap.killTweensOf(`.bounce-card-${i}`);
      const baseTransform = transformStyles[i] || 'none';
      gsap.to(`.bounce-card-${i}`, {
        transform: baseTransform,
        duration: 0.4,
        ease: 'back.out(1.4)',
        overwrite: 'auto'
      });
    });
  };

  return (
    <div
      className={`bounceCardsContainer ${className}`}
      style={{
        position: 'relative',
        width: containerWidth,
        height: containerHeight
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={card.id}
          className={`bounce-card bounce-card-${idx} ${card.isActive ? 'active' : ''}`}
          style={{ transform: transformStyles[idx] ?? 'none' }}
          onMouseEnter={() => pushSiblings(idx)}
          onMouseLeave={resetSiblings}
          onClick={() => onCardClick(card)}
        >
          <div className="bounce-card-content">
            <h3 className="bounce-card-title">{card.name}</h3>
            {card.grade && (
              <div className="bounce-card-grade">
                <span className="grade-letter">{card.grade}</span>
                <span className="grade-percent">{card.score}%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
