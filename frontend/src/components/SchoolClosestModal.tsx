import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Modal } from './Modal';
import { Button } from './Button';
import { buildUrlPath } from '../services/urlState';

export const SchoolClosestModal: React.FC = () => {
  const { 
    showSchoolClosestModal, 
    schoolClosestModalData, 
    setShowSchoolClosestModal,
    setMapIntent
  } = useStore();
  
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';

  const handleClose = () => {
    setShowSchoolClosestModal(false);
    if (schoolClosestModalData) {
      // Zoom out to show all routes for that school
      const urlState = {
        show: 'routes' as const,
        schoolId: schoolClosestModalData.schoolId,
        direction: basePath === '/admin' ? ('both' as const) : ('morning' as const),
        routeNames: [],
        focus: undefined
      };
      
      navigate(buildUrlPath(basePath, urlState));
      
      // Force map to overview
      setTimeout(() => {
        setMapIntent({ type: 'FIT_ROUTES' });
      }, 100);
    }
  };

  return (
    <Modal isOpen={showSchoolClosestModal} onClose={handleClose}>
      <Modal.Header>
        {/* Route Icon - Figma "Union" asset */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <svg width="25" height="26" viewBox="0 0 25 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.2705 0C11.9884 3.76818e-08 13.4472 1.10802 13.9717 2.64844H18.8242C21.8936 2.64853 24.3818 5.1367 24.3818 8.20605C24.3815 11.2752 21.8934 13.7636 18.8242 13.7637H5.98926C4.12152 13.7637 2.60742 15.2778 2.60742 17.1455C2.60769 19.013 4.12169 20.5273 5.98926 20.5273H16.3799C16.8585 18.7486 18.4812 17.4395 20.4111 17.4395C22.7174 17.4395 24.5869 19.309 24.5869 21.6152C24.5867 23.9213 22.7172 25.791 20.4111 25.791C18.4815 25.791 16.8588 24.4814 16.3799 22.7031H5.98926C2.92003 22.7031 0.431906 20.2147 0.431641 17.1455C0.431641 14.0761 2.91986 11.5879 5.98926 11.5879H18.8242C20.6917 11.5878 22.2058 10.0735 22.2061 8.20605C22.2061 6.33836 20.6919 4.82431 18.8242 4.82422H14.0713C13.6589 6.54105 12.1138 7.81738 10.2705 7.81738H3.9082C1.74966 7.81719 0.000126318 6.06677 0 3.9082C0.000195126 1.7497 1.7497 0.000192692 3.9082 0H10.2705ZM20.4111 19.6152C19.3066 19.6153 18.4111 20.5107 18.4111 21.6152C18.4114 22.7196 19.3067 23.6152 20.4111 23.6152C21.5156 23.6152 22.4109 22.7196 22.4111 21.6152C22.4111 20.5107 21.5157 19.6152 20.4111 19.6152ZM3.73145 2.18457C2.91577 2.26738 2.26738 2.91577 2.18457 3.73145L2.17578 3.9082C2.1759 4.80545 2.85757 5.54412 3.73145 5.63281L3.9082 5.6416H10.2705L10.4482 5.63281C11.322 5.544 12.0038 4.80535 12.0039 3.9082C12.0037 3.01112 11.3219 2.27339 10.4482 2.18457L10.2705 2.17578H3.9082L3.73145 2.18457Z" fill="var(--text-primary)"/>
          </svg>
        </div>
      </Modal.Header>
      
      <Modal.Content>
        <Modal.Title>
          {schoolClosestModalData?.schoolName} is closer than any stop that is available
        </Modal.Title>
        <Modal.Description>
          Walking might be best, or make sure that this is the correct school for your address
        </Modal.Description>
      </Modal.Content>

      <Modal.Footer>
        <Button onClick={handleClose} fullWidth size="large">
          Okay
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
