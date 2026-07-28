import React, { createContext, useContext } from 'react';
import { ICitizenRepository } from '../../domain/repositories/ICitizenRepository';

export interface IDependencies {
  citizenRepository: ICitizenRepository;
}

const DependencyContext = createContext<IDependencies | null>(null);

export const DependencyProvider: React.FC<{ dependencies: IDependencies; children: React.ReactNode }> = ({ dependencies, children }) => {
  return (
    <DependencyContext.Provider value={dependencies}>
      {children}
    </DependencyContext.Provider>
  );
};

export const useDependencies = (): IDependencies => {
  const context = useContext(DependencyContext);
  if (!context) {
    throw new Error('useDependencies must be used within a DependencyProvider');
  }
  return context;
};
