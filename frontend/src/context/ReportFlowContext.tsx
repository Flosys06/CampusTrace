import React, { createContext, useContext, useState } from 'react';
import { CameraReportFlow } from '../components/camera/CameraReportFlow';

interface ReportFlowContextType {
  isOpen: boolean;
  openReportFlow: (type?: 'LOST' | 'FOUND') => void;
  closeReportFlow: () => void;
}

const ReportFlowContext = createContext<ReportFlowContextType | undefined>(undefined);

export const ReportFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialType, setInitialType] = useState<'LOST' | 'FOUND'>('LOST');

  const openReportFlow = (type: 'LOST' | 'FOUND' = 'LOST') => {
    setInitialType(type);
    setIsOpen(true);
  };

  const closeReportFlow = () => {
    setIsOpen(false);
  };

  return (
    <ReportFlowContext.Provider value={{ isOpen, openReportFlow, closeReportFlow }}>
      {children}
      {isOpen && (
        <CameraReportFlow
          initialType={initialType}
          onClose={closeReportFlow}
          onSuccess={() => {
            closeReportFlow();
          }}
        />
      )}
    </ReportFlowContext.Provider>
  );
};

export const useReportFlow = () => {
  const context = useContext(ReportFlowContext);
  if (!context) {
    throw new Error('useReportFlow must be used within a ReportFlowProvider');
  }
  return context;
};
