// src/components/ui/DropdownMenu.tsx
import { ReactNode, useState, useRef, useEffect, createContext, useContext } from 'react';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined);

const useDropdown = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within DropdownMenu');
  }
  return context;
};

interface DropdownMenuProps {
  children: ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={dropdownRef} className="relative">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({ children, asChild }: DropdownMenuTriggerProps) {
  const { isOpen, setIsOpen } = useDropdown();

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  if (asChild) {
    return (
      <div onClick={handleClick} className="inline-block">
        {children}
      </div>
    );
  }

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}

interface DropdownMenuContentProps {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function DropdownMenuContent({ children, align = 'end' }: DropdownMenuContentProps) {
  const { isOpen } = useDropdown();

  if (!isOpen) return null;

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div
      className={`absolute top-full mt-2 w-56 rounded-md border border-border bg-white p-1 shadow-lg ${alignmentClasses[align]} z-50`}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  asChild?: boolean;
  className?: string;
}

export function DropdownMenuItem({ children, onClick, asChild, className = '' }: DropdownMenuItemProps) {
  const { setIsOpen } = useDropdown();

  const handleClick = () => {
    if (onClick) onClick();
    setIsOpen(false);
  };

  const baseClasses = 'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100';

  if (asChild) {
    return (
      <div className={`${baseClasses} ${className}`} onClick={handleClick}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${className}`}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

interface DropdownMenuLabelProps {
  children: ReactNode;
}

export function DropdownMenuLabel({ children }: DropdownMenuLabelProps) {
  return (
    <div className="px-2 py-1.5 text-sm font-semibold text-gray-900">
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-gray-200" />;
}