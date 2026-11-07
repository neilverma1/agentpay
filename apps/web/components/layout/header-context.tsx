'use client';

import * as React from 'react';

export interface HeaderContextType {
  title: React.ReactNode | null;
  setTitle: (title: React.ReactNode | null) => void;
}

const HeaderContext = React.createContext<HeaderContextType>({
  title: null,
  setTitle: () => {},
});

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = React.useState<React.ReactNode | null>(null);

  const value = React.useMemo(() => ({ title, setTitle }), [title]);

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeader(): HeaderContextType {
  return React.useContext(HeaderContext);
}
