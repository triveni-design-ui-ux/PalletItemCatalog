import { createContext, ReactNode, useState } from "react";

interface ItemsContextType {
  totalItems: number;
  setTotalItems: (count: number) => void;
}

export const ItemsContext = createContext<ItemsContextType>({
  totalItems: 0,
  setTotalItems: () => {},
});

export function ItemsProvider({ children }: { children: ReactNode }) {
  const [totalItems, setTotalItems] = useState(0);

  const handleSetTotalItems = (count: number) => {
    console.log("ItemsContext - setTotalItems called with:", count);
    setTotalItems(count);
  };

  return (
    <ItemsContext.Provider
      value={{ totalItems, setTotalItems: handleSetTotalItems }}
    >
      {children}
    </ItemsContext.Provider>
  );
}
