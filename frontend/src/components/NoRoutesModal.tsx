import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RouteIcon } from './RouteIcon';

interface NoRoutesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDifferentSchool: () => void;
    schoolName?: string;
}

export const NoRoutesModal: React.FC<NoRoutesModalProps> = ({
    isOpen,
    onClose,
    onSelectDifferentSchool,
    schoolName
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <Modal.Header style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <RouteIcon size={25} color="var(--text-primary)" />
                </div>
                <div style={{
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    color: '#f44',
                    fontSize: '11px',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '10px' }}></i>
                    NO ROUTES
                </div>
            </Modal.Header>

            <Modal.Content>
                <Modal.Title>
                    {schoolName ? `${schoolName} has no routes provided` : 'No routes provided for this school'}
                </Modal.Title>
                <Modal.Description>
                    Route information not provided on the web by school district.
                </Modal.Description>
            </Modal.Content>

            <Modal.Footer>
                <Button onClick={onSelectDifferentSchool} fullWidth size="large" variant="primary" align="center">
                    Select Different School
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
