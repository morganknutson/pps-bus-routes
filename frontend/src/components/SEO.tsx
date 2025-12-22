import React from 'react';
import { Helmet } from 'react-helmet-async';
import { School, Route, Stop } from '../types';
import { useStore } from '../store/useStore';

interface FAQItem {
  question: string;
  answer: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: string;
  school?: School;
  selectedRoutes?: Route[];
  selectedStop?: { route: Route; stop: Stop; stopNumber: number } | null;
  faqItems?: FAQItem[];
}

export const SEO: React.FC<SEOProps> = ({
  title: manualTitle,
  description: manualDescription,
  keywords = 'PPS, Portland Public Schools, bus routes, school bus, Portland, education, transportation',
  canonical,
  ogType = 'website',
  ogImage = '/og-image.png',
  twitterCard = 'summary_large_image',
  school,
  selectedRoutes = [],
  selectedStop,
  faqItems,
}) => {
  const isDarkMode = useStore(state => state.isDarkMode);
  const themeColor = isDarkMode ? '#3A3A3A' : '#ffffff';
  
  const siteTitle = 'PPS Bus Routes';
  const url = window.location.href;
  const origin = window.location.origin;

  // 1. Dynamic Title Hierarchy
  let title = manualTitle;
  if (selectedStop) {
    title = `Stop at ${selectedStop.stop.address} | Route ${selectedStop.route.name}${school ? ` | ${school.name}` : ''}`;
  } else if (selectedRoutes.length > 0) {
    const names = selectedRoutes.map(r => r.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ');
    title = `Route${selectedRoutes.length > 1 ? 's' : ''} ${names}${school ? ` | ${school.name}` : ''}`;
  } else if (school) {
    title = `${school.name} Bus Routes`;
  }

  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} | Portland Public Schools`;

  // 2. Dynamic Description
  let description = manualDescription || 'Interactive bus route maps for Portland Public Schools. Find your school, view routes, and locate bus stops.';
  if (selectedStop) {
    description = `View bus stop at ${selectedStop.stop.address} for ${school?.name || 'Portland Public Schools'}. Route ${selectedStop.route.name} map and schedule.`;
  } else if (selectedRoutes.length > 0) {
    const names = selectedRoutes.map(r => r.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ');
    description = `Interactive map showing bus route${selectedRoutes.length > 1 ? 's' : ''} ${names}${school ? ` for ${school.name}` : ''}.`;
  } else if (school) {
    description = `Find bus routes and stop locations for ${school.name}. Interactive maps and schedules for PPS students and families.`;
  }

  // 3. Absolute URL for Image Compatibility
  // og:image must be an absolute URL for many platforms to display it correctly
  const absoluteOgImage = ogImage.startsWith('http') 
    ? ogImage 
    : `${origin}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;

  // Generate JSON-LD Structured Data
  const structuredData = [];

  // 1. Organization Schema (Base)
  structuredData.push({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Portland Public Schools Bus Maps",
    "url": "https://pps-bus-maps.vercel.app",
    "logo": "https://pps-bus-maps.vercel.app/school-bus-front.svg",
    "description": "Providing bus route and stop information for PPS students and families."
  });

  // 2. School Specific Schema
  if (school) {
    const schoolSchema: any = {
      "@context": "https://schema.org",
      "@type": "School",
      "name": school.name,
      "description": `Bus routes and stops for ${school.name} in Portland Public Schools.`,
      "url": url,
    };

    if (school.address) {
      schoolSchema.address = {
        "@type": "PostalAddress",
        "streetAddress": school.address,
        "addressLocality": "Portland",
        "addressRegion": "OR"
      };
    }

    if (school.coordinates) {
      schoolSchema.geo = {
        "@type": "GeoCoordinates",
        "latitude": school.coordinates[1],
        "longitude": school.coordinates[0]
      };
    }

    structuredData.push(schoolSchema);
  }

  // 3. FAQ Schema
  if (faqItems && faqItems.length > 0) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer
        }
      }))
    });
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="theme-color" content={themeColor} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/png" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />

      {/* Structured Data */}
      {structuredData.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};
