import React, { createContext, useContext, useState } from 'react';
import { CameraReportFlow } from '../components/camera/CameraReportFlow';

interface ReportFlowContextType {
  isOpen: boolean;
  openReportFlow: (
    type?: 'LOST' | 'FOUND',
    preloadedFile?: File | null,
    preloadedLabel?: string | null
  ) => void;
  closeReportFlow: () => void;
}

const ReportFlowContext = createContext<ReportFlowContextType | undefined>(undefined);

export const ReportFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialType, setInitialType] = useState<'LOST' | 'FOUND'>('FOUND');
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialLabel, setInitialLabel] = useState<string | null>(null);

  const openReportFlow = (
    type: 'LOST' | 'FOUND' = 'FOUND',
    preloadedFile?: File | null,
    preloadedLabel?: string | null
  ) => {
    setInitialType(type);
    setInitialFile(preloadedFile || null);
    setInitialLabel(preloadedLabel || null);
    setIsOpen(true);
  };

  const closeReportFlow = () => {
    setIsOpen(false);
    setInitialFile(null);
    setInitialLabel(null);
  };

  return (
    <ReportFlowContext.Provider value={{ isOpen, openReportFlow, closeReportFlow }}>
      {children}
      {isOpen && (
        <CameraReportFlow
          initialType={initialType}
          initialFile={initialFile}
          initialLabel={initialLabel}
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
