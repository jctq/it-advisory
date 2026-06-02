export type MarketingParallaxHeroOverlay = 'dark' | 'light' | 'balanced';

export type MarketingParallaxHeroLayout = 'centered';

export type MarketingParallaxHeroVisual = 'photo-art';

export type MarketingParallaxHeroConfig = {
  readonly imageSrc: string;
  readonly imageAlt: string;
  readonly objectPosition: string;
  readonly overlay: MarketingParallaxHeroOverlay;
  readonly visual: MarketingParallaxHeroVisual;
  readonly layout: MarketingParallaxHeroLayout;
};

/** Production homepage hero: team collaboration photo with topology art overlay. */
export const MARKETING_PARALLAX_HERO: MarketingParallaxHeroConfig = {
  imageSrc: '/marketing/hero/hero-team-collab.jpg',
  imageAlt: 'Technology team collaborating around a laptop in a modern office',
  objectPosition: '62% 42%',
  overlay: 'balanced',
  visual: 'photo-art',
  layout: 'centered',
};
