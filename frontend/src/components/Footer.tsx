import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useDarkMode } from '../hooks/useDarkMode';

export function Footer() {
  const { isDarkMode } = useDarkMode();
  const setSelectedSchool = useStore(state => state.setSelectedSchool);
  const setRoutes = useStore(state => state.setRoutes);

  // Match header background colors
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const textColorMuted = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
  const textColorTertiary = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

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
            <svg width="96" height="46" viewBox="0 0 96 46" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M35.3486 5C35.1934 5.32667 35.05 5.66 34.9199 6H6C3.32472 6 1.14053 8.10111 1.00684 10.7432L1 11V40C1 42.7614 3.23858 45 6 45H90C92.7614 45 95 42.7614 95 40V11C95 8.23858 92.7614 6 90 6H61.0801C60.95 5.66 60.8066 5.32667 60.6514 5H90C93.3137 5 96 7.68629 96 11V40C96 43.3137 93.3137 46 90 46H6C2.68629 46 0 43.3137 0 40V11C0 7.68629 2.68629 5 6 5H35.3486Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M28.7373 25.6855C33.177 25.6855 35.5789 28.0555 35.5791 31.7998C35.5791 35.1495 33.2562 37.7412 28.7373 37.7412C24.2502 37.7411 21.8965 35.1494 21.8965 31.7998C21.8967 28.0397 24.3136 25.6856 28.7373 25.6855ZM28.7217 27.6133C25.9252 27.6133 24.1398 29.0987 24.1396 31.6738C24.1398 34.328 25.8777 35.8134 28.7373 35.8135C31.5813 35.8135 33.3348 34.3913 33.335 31.6738C33.3348 29.1144 31.5814 27.6133 28.7217 27.6133Z" fill="white"/>
              <path d="M39.8027 32.3848C39.8028 34.8336 41.0829 35.8134 43.6582 35.8135C46.2968 35.8135 47.5137 34.7857 47.5137 32.4473V25.9697H49.7568V32.6055C49.7568 35.9077 47.7189 37.7412 43.6582 37.7412C39.5976 37.7412 37.5596 35.9235 37.5596 32.6055V25.9697H39.8027V32.3848Z" fill="white"/>
              <path d="M82.917 25.6855C86.2032 25.6855 88.3048 26.7128 88.9844 28.7666L86.8672 29.4619C86.3773 28.1034 85.0655 27.5498 82.8379 27.5498C81.0687 27.5498 79.7896 28.0397 79.7891 28.9873C79.7891 29.7615 80.8157 30.0619 81.7637 30.2041L85.082 30.6943C87.7359 31.0893 89.1735 32.1636 89.1738 34.0117C89.1738 36.4291 87.0726 37.7411 83.502 37.7412C79.9785 37.7412 77.7186 36.4135 77.1182 34.4385L79.2832 33.7588C79.931 35.1491 81.3526 35.8134 83.5645 35.8135C85.555 35.8135 86.9303 35.134 86.9307 34.2178C86.9303 33.4596 85.9662 32.9853 84.6709 32.8115L81.8105 32.416C78.9038 32.0209 77.545 30.8361 77.5449 29.1299C77.5452 26.8865 79.4886 25.6856 82.917 25.6855Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M15.6123 25.9697C18.867 25.9697 20.1786 27.0445 20.1787 29.3984C20.1786 31.3259 18.8834 32.6528 16.9717 32.7793L20.4951 37.4561H17.7295L14.3965 32.9375H10.8408V37.4561H8.59766V25.9697H15.6123ZM10.8408 31.0732H15.2812C17.335 31.0732 17.9355 30.6145 17.9355 29.4453C17.9352 28.2926 17.2871 27.834 15.2812 27.834H10.8408V31.0732Z" fill="white"/>
              <path d="M63.9512 27.8975H58.8164V37.4561H56.5723V27.8975H51.4375V25.9697H63.9512V27.8975Z" fill="white"/>
              <path d="M75.9287 27.8975H67.8701V30.5674H74.8066V32.4951H67.8701V35.5283H76.1182V37.4561H65.627V25.9697H75.9287V27.8975Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M44.2041 5.01074C45.0152 5.09297 45.6825 5.65971 45.9131 6.41699H50C51.4267 6.417 52.583 7.57327 52.583 9C52.583 10.4267 51.4267 11.583 50 11.583H46C45.2176 11.583 44.583 12.2176 44.583 13C44.583 13.7824 45.2176 14.417 46 14.417H50.0869C50.3365 13.5969 51.0983 13 52 13L52.2041 13.0107C53.2128 13.113 54 13.9643 54 15L53.9893 15.2041C53.887 16.2128 53.0356 17 52 17L51.7959 16.9893C50.9849 16.907 50.3184 16.3402 50.0879 15.583H46C44.5733 15.583 43.417 14.4267 43.417 13C43.417 11.5733 44.5733 10.417 46 10.417H50C50.7824 10.417 51.417 9.78239 51.417 9C51.417 8.2176 50.7824 7.58301 50 7.58301H45.9131C45.6636 8.40315 44.9017 9 44 9L43.7959 8.98926C42.8543 8.8938 42.1062 8.14565 42.0107 7.2041L42 7C42 5.89543 42.8954 5 44 5L44.2041 5.01074ZM52 14.167C51.5398 14.167 51.167 14.5398 51.167 15C51.167 15.4602 51.5398 15.833 52 15.833C52.4602 15.833 52.833 15.4602 52.833 15C52.833 14.5398 52.4602 14.167 52 14.167ZM44 6.16699C43.5398 6.16699 43.167 6.53976 43.167 7C43.167 7.46024 43.5398 7.83301 44 7.83301C44.4602 7.83301 44.833 7.46024 44.833 7C44.833 6.53976 44.4602 6.16699 44 6.16699Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M48 0C54.0751 0 59 4.92487 59 11C59 17.0751 54.0751 22 48 22C41.9249 22 37 17.0751 37 11C37 4.92487 41.9249 0 48 0ZM48 1C42.4772 1 38 5.47715 38 11C38 16.5228 42.4772 21 48 21C53.5228 21 58 16.5228 58 11C58 5.47715 53.5228 1 48 1Z" fill="white"/>
              <path d="M26.8379 13C28.7097 13 29.9069 13.585 30.2939 14.7549L29.0879 15.1514C28.8089 14.3774 28.0618 14.0625 26.793 14.0625C25.7851 14.0625 25.0559 14.341 25.0557 14.8809C25.0557 15.3218 25.6407 15.4932 26.1807 15.5742L28.0703 15.8535C29.5823 16.0785 30.4014 16.6902 30.4014 17.7432C30.4013 19.1201 29.2048 19.8671 27.1709 19.8672C25.1641 19.8672 23.8773 19.1111 23.5352 17.9863L24.7676 17.5986C25.1366 18.3906 25.947 18.7695 27.207 18.7695C28.3407 18.7695 29.1238 18.3822 29.124 17.8604C29.124 17.4284 28.5749 17.1576 27.8369 17.0586L26.208 16.834C24.552 16.609 23.7773 15.9339 23.7773 14.9619C23.7774 13.684 24.885 13 26.8379 13Z" fill="white"/>
              <path d="M75.2754 16.8164C75.2755 18.2112 76.0048 18.7695 77.4717 18.7695C78.9745 18.7695 79.6678 18.1842 79.668 16.8525V13.1621H80.9453V16.9424C80.9452 18.8232 79.7845 19.8672 77.4717 19.8672C75.1588 19.8672 73.9982 18.8322 73.998 16.9424V13.1621H75.2754V16.8164Z" fill="white"/>
              <path d="M85.3408 13C87.2127 13 88.4098 13.585 88.7969 14.7549L87.5908 15.1514C87.3118 14.3774 86.5648 14.0625 85.2959 14.0625C84.288 14.0625 83.5588 14.341 83.5586 14.8809C83.5586 15.3218 84.1436 15.4932 84.6836 15.5742L86.5732 15.8535C88.0852 16.0785 88.9043 16.6902 88.9043 17.7432C88.9042 19.1201 87.7077 19.8671 85.6738 19.8672C83.667 19.8672 82.3802 19.1111 82.0381 17.9863L83.2705 17.5986C83.6395 18.3906 84.45 18.7695 85.71 18.7695C86.8436 18.7695 87.6267 18.3822 87.627 17.8604C87.627 17.4284 87.0778 17.1576 86.3398 17.0586L84.7109 16.834C83.0549 16.609 82.2803 15.9339 82.2803 14.9619C82.2804 13.684 83.3879 13 85.3408 13Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12.8691 13.1621C14.6961 13.1621 15.5693 13.729 15.5693 15.1689C15.5693 16.5909 14.7144 17.167 12.8154 17.167H10.2773V19.7051H9V13.1621H12.8691ZM10.2773 16.0693H12.9951C14.0211 16.0693 14.292 15.7811 14.292 15.1602C14.292 14.5752 14.0485 14.2598 12.9775 14.2598H10.2773V16.0693Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M20.3662 13.1621C22.1932 13.1621 23.0664 13.729 23.0664 15.1689C23.0664 16.5909 22.2115 17.167 20.3125 17.167H17.7744V19.7051H16.4971V13.1621H20.3662ZM17.7744 16.0693H20.4922C21.5181 16.0693 21.789 15.7811 21.7891 15.1602C21.7891 14.5752 21.5456 14.2598 20.4746 14.2598H17.7744V16.0693Z" fill="white"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M69.9775 13.1621C71.6515 13.1621 72.5068 13.711 72.5068 14.8359C72.5068 15.4569 72.2998 15.8623 71.751 16.1953C72.3446 16.4564 72.7586 17.095 72.7588 17.8057C72.7588 19.0387 71.7505 19.7051 70.2295 19.7051H66V13.1621H69.9775ZM67.2773 18.6436H70.1035C71.0395 18.6436 71.4805 18.373 71.4805 17.707C71.4804 17.0951 71.0305 16.8066 70.1035 16.8066H67.2773V18.6436ZM67.2773 15.7451H70.0498C70.8056 15.7451 71.2284 15.5561 71.2285 14.9893C71.2285 14.4223 70.8327 14.2237 70.0498 14.2236H67.2773V15.7451Z" fill="white"/>
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
          >
            <i className="fas fa-search-location" style={{ width: '16px' }}></i>
            Find My Stop
          </Link>
          <Link
            to="/schools"
            onClick={() => {
              setSelectedSchool(null);
              setRoutes([]);
            }}
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

