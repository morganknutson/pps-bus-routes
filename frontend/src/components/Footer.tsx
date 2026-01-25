import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useDarkMode } from '../hooks/useDarkMode';

export function Footer() {
  useDarkMode();

  // Footer background is always dark, so keep content light in both themes
  const textColor = '#ffffff';
  const textColorMuted = 'rgba(255, 255, 255, 0.8)';
  const textColorTertiary = 'rgba(255, 255, 255, 0.4)';

  const linkStyle: React.CSSProperties = {
    color: textColorMuted,
    fontSize: '14px',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'color 0.2s ease',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = textColor;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = textColorMuted;
  };

  return (
    <footer style={{
      width: '100%',
      padding: '4rem 2rem',
      backgroundColor: '#0d2843',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
      marginTop: 'auto',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        maxWidth: '1000px',
        width: '100%',
        flexDirection: window.innerWidth < 600 ? 'column' : 'row',
        gap: '2rem',
      }}>
        {/* Left side: Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Link to="/" style={{ display: 'block', opacity: 0.9, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}>
            <svg width="153" height="52" viewBox="0 0 153 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M147 0C150.314 0 153 2.68629 153 6V46L152.992 46.3086C152.837 49.3767 150.377 51.8367 147.309 51.9922L147 52H6L5.69141 51.9922C2.62332 51.8367 0.163251 49.3767 0.0078125 46.3086L0 46V6C6.44277e-07 2.68629 2.68629 1.14758e-07 6 0H147ZM54.875 50.25H147C149.347 50.25 151.25 48.3472 151.25 46V6C151.25 3.65279 149.347 1.75 147 1.75H54.875V50.25ZM6 1.75C3.65279 1.75 1.75 3.65279 1.75 6V46C1.75 48.3472 3.65279 50.25 6 50.25H53.125V1.75H6ZM85.2285 29.0449C89.1443 29.0451 91.2635 31.1358 91.2637 34.4385C91.2637 37.393 89.2141 39.6785 85.2285 39.6787C81.2705 39.6787 79.1943 37.3931 79.1943 34.4385C79.1945 31.1218 81.3264 29.0449 85.2285 29.0449ZM94.9893 34.9541C94.9893 37.1143 96.118 37.9785 98.3896 37.9785C100.717 37.9784 101.79 37.0723 101.79 35.0098V29.2959H103.77V35.1494C103.77 38.0621 101.971 39.6786 98.3896 39.6787C94.8079 39.6787 93.0098 38.0761 93.0098 35.1494V29.2959H94.9893V34.9541ZM133.019 29.0449C135.917 29.045 137.771 29.9512 138.37 31.7627L136.503 32.376C136.071 31.1777 134.914 30.6896 132.949 30.6895C131.388 30.6895 130.259 31.1219 130.259 31.958C130.259 32.6408 131.165 32.9058 132.001 33.0312L134.928 33.4629C137.269 33.8113 138.537 34.7594 138.537 36.3896C138.537 38.5219 136.684 39.6786 133.534 39.6787C130.427 39.6787 128.433 38.5085 127.903 36.7666L129.813 36.167C130.385 37.3931 131.639 37.9785 133.59 37.9785C135.345 37.9784 136.558 37.3794 136.559 36.5713C136.558 35.9025 135.708 35.4844 134.565 35.3311L132.043 34.9824C129.479 34.634 128.28 33.5882 128.28 32.083C128.281 30.1043 129.995 29.0449 133.019 29.0449ZM73.6514 29.2959C76.5219 29.296 77.6796 30.244 77.6797 32.3203C77.6797 34.0203 76.5364 35.1909 74.8506 35.3027L77.958 39.4277H75.5195L72.5781 35.4424H69.4424V39.4277H67.4639V29.2959H73.6514ZM116.289 30.9961H111.76V39.4277H109.781V30.9961H105.251V29.2959H116.289V30.9961ZM126.854 30.9961H119.746V33.3516H125.864V35.0518H119.746V37.7275H127.021V39.4277H117.767V29.2959H126.854V30.9961ZM25.2881 13.584C27.006 13.584 28.4648 14.692 28.9893 16.2324H33.7031C36.8479 16.2326 39.3935 18.7888 39.3809 21.9336C39.3677 25.0601 36.8297 27.5887 33.7031 27.5889H20.8672C19.0609 27.5891 17.5988 29.0579 17.6064 30.8643C17.6148 32.6592 19.0721 34.1111 20.8672 34.1113H32.916C33.3796 32.6121 34.7772 31.5235 36.4287 31.5234C38.4588 31.5234 40.1045 33.1691 40.1045 35.1992C40.104 37.2289 38.4585 38.875 36.4287 38.875C34.7777 38.875 33.3811 37.7856 32.917 36.2871H20.8672C17.8739 36.2869 15.4439 33.8662 15.4307 30.873C15.4179 27.8615 17.8556 25.4133 20.8672 25.4131H33.7031C35.6315 25.4129 37.1967 23.8531 37.2051 21.9248C37.2129 19.985 35.6429 18.4084 33.7031 18.4082H29.0889C28.6763 20.1248 27.1312 21.4014 25.2881 21.4014H18.9258C16.7674 21.4012 15.018 19.6505 15.0176 17.4922C15.0178 15.3337 16.7673 13.5842 18.9258 13.584H25.2881ZM85.2148 30.7451C82.7481 30.7451 81.173 32.0556 81.1729 34.3271C81.1729 36.6685 82.706 37.9785 85.2285 37.9785C87.7369 37.9784 89.2842 36.7241 89.2842 34.3271C89.2841 32.0697 87.7369 30.7454 85.2148 30.7451ZM36.4287 33.6992C35.6003 33.6993 34.9287 34.3708 34.9287 35.1992C34.9292 36.0272 35.6006 36.6992 36.4287 36.6992C37.2568 36.6992 37.9282 36.0272 37.9287 35.1992C37.9287 34.3708 37.2571 33.6992 36.4287 33.6992ZM69.4424 33.7979H73.3594C75.1703 33.7977 75.7001 33.3933 75.7002 32.3623C75.7001 31.3452 75.1285 30.9406 73.3594 30.9404H69.4424V33.7979ZM93.1416 13.1172C95.8361 13.1173 97.5592 13.9594 98.1162 15.6436L96.3809 16.2129C95.9793 15.099 94.9033 14.6456 93.0771 14.6455C91.6264 14.6455 90.5765 15.0471 90.5762 15.8242C90.5763 16.4589 91.419 16.7057 92.1963 16.8223L94.916 17.2236C97.0922 17.5476 98.2714 18.4287 98.2715 19.9443C98.2714 21.9263 96.5486 23.0018 93.6211 23.002C90.7322 23.002 88.8792 21.9132 88.3867 20.2939L90.1621 19.7373C90.6934 20.877 91.8594 21.4209 93.6729 21.4209C95.3045 21.4208 96.432 20.8643 96.4326 20.1133C96.4326 19.4916 95.642 19.1026 94.5801 18.96L92.2344 18.6357C89.851 18.3118 88.7365 17.3403 88.7363 15.9414C88.7363 14.1017 90.3303 13.1172 93.1416 13.1172ZM118.661 18.5322C118.661 20.54 119.711 21.3428 121.822 21.3428C123.985 21.3425 124.983 20.5008 124.983 18.584V13.2715H126.823V18.7129C126.823 21.4203 125.151 22.9236 121.822 22.9238C118.493 22.9238 116.821 21.4335 116.821 18.7129V13.2715H118.661V18.5322ZM133.149 13.0391C135.844 13.0392 137.568 13.8814 138.125 15.5654L136.389 16.1348C135.987 15.021 134.911 14.5675 133.085 14.5674C131.634 14.5674 130.585 14.969 130.585 15.7461C130.585 16.3808 131.427 16.6275 132.204 16.7441L134.925 17.1455C137.101 17.4695 138.28 18.3507 138.28 19.8662C138.28 21.8481 136.556 22.9236 133.629 22.9238C130.74 22.9238 128.888 21.835 128.396 20.2158L130.17 19.6592C130.701 20.7988 131.867 21.3427 133.681 21.3428C135.312 21.3426 136.44 20.7861 136.44 20.0352C136.44 19.4135 135.65 19.0245 134.588 18.8818L132.243 18.5576C129.86 18.2338 128.745 17.2623 128.745 15.8633C128.745 14.0237 130.338 13.0391 133.149 13.0391ZM73.0342 13.3496C75.6638 13.3497 76.9209 14.1665 76.9209 16.2393C76.9208 18.2858 75.6899 19.1151 72.957 19.1152H69.3037V22.7686H67.4639V13.3496H73.0342ZM83.8262 13.3496C86.4558 13.3497 87.7129 14.1665 87.7129 16.2393C87.7128 18.2858 86.482 19.1151 83.749 19.1152H80.0957V22.7686H78.2559V13.3496H83.8262ZM111.034 13.2715C113.443 13.2717 114.675 14.0624 114.675 15.6816C114.675 16.5752 114.377 17.1584 113.587 17.6377C114.442 18.0136 115.038 18.9339 115.038 19.957C115.038 21.7315 113.586 22.6901 111.397 22.6904H105.309V13.2715H111.034ZM107.147 21.1621H111.216C112.563 21.1619 113.198 20.7729 113.198 19.8145C113.198 18.9337 112.55 18.5187 111.216 18.5186H107.147V21.1621ZM18.749 15.7686C17.9334 15.8514 17.285 16.4998 17.2021 17.3154L17.1934 17.4922C17.1937 18.3892 17.8753 19.1281 18.749 19.2168L18.9258 19.2256H25.2881L25.4658 19.2168C26.3394 19.128 27.0211 18.3891 27.0215 17.4922C27.0213 16.5951 26.3395 15.8574 25.4658 15.7686L25.2881 15.7598H18.9258L18.749 15.7686ZM69.3037 17.5352H73.2158C74.692 17.5351 75.0809 17.12 75.0811 16.2266C75.0811 15.3845 74.7307 14.9308 73.1895 14.9307H69.3037V17.5352ZM80.0957 17.5352H84.0078C85.484 17.5351 85.8729 17.12 85.873 16.2266C85.873 15.3845 85.5227 14.9308 83.9814 14.9307H80.0957V17.5352ZM107.147 16.9902H111.139C112.226 16.99 112.835 16.7178 112.835 15.9023C112.835 15.0865 112.265 14.801 111.139 14.8008H107.147V16.9902Z" fill="white"/>
            </svg>
          </Link>
          <div style={{ color: textColorTertiary, fontSize: '12px' }}>
            Application Copyright {new Date().getFullYear()} PPS Bus Routes.
          </div>
        </div>

        {/* Right side: Stacked Links */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem',
          alignItems: 'flex-start',
          textAlign: 'left',
          marginRight: '30px',
        }}>
          <Link
            to="/"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => {
              if (window.location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <i className="fas fa-search-location" style={{ width: '16px' }}></i>
            Find My Stop
          </Link>
          <Link
            to="/schools"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-map" style={{ width: '16px' }}></i>
            Explore Map
          </Link>
          <Link
            to="/school-directory"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-graduation-cap" style={{ width: '16px' }}></i>
            School Directory
          </Link>
          <Link
            to="/neighborhood-directory"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-city" style={{ width: '16px' }}></i>
            Browse by Neighborhood
          </Link>
          <Link
            to="/about"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
            About
          </Link>
          <Link
            to="/contact"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-envelope" style={{ width: '16px' }}></i>
            Contact
          </Link>
          <Link
            to="/data"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <i className="fas fa-database" style={{ width: '16px' }}></i>
            Data
          </Link>
        </div>
      </div>

      {/* Bottom: Disclaimer */}
      <div style={{
        marginTop: '4rem',
        color: textColorTertiary,
        fontSize: '12px',
        textAlign: 'center',
        maxWidth: '800px',
        lineHeight: '1.6',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        paddingTop: '2rem',
        width: '100%',
      }}>
        This is not an official Portland Public Schools website.<br /> Always refer to official PPS transportation communications for final route information.
      </div>
    </footer>
  );
}

