import React from 'react';
import { Helmet } from 'react-helmet-async';
import { School } from '../types';

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
  faqItems?: FAQItem[];
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = 'Interactive bus route maps for Portland Public Schools. Find your school, view routes, and locate bus stops.',
  keywords = 'PPS, Portland Public Schools, bus routes, school bus, Portland, education, transportation',
  canonical,
  ogType = 'website',
  ogImage = '/school-bus-front.svg',
  twitterCard = 'summary_large_image',
  school,
  faqItems,
}) => {
  const siteTitle = 'PPS Bus Routes';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const url = window.location.href;

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
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data */}
      {structuredData.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};
