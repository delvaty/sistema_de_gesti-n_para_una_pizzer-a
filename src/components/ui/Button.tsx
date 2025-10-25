// import React from 'react';
// import { Slot } from '@radix-ui/react-slot';
// import { cva, type VariantProps } from 'class-variance-authority';
// import { twMerge } from 'tailwind-merge';

// const buttonVariants = cva(
//   'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
//   {
//     variants: {
//       variant: {
//         default: 'bg-primary text-white hover:bg-primary/90 focus:ring-primary',
//         destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
//         outline: 'border border-border bg-transparent hover:bg-surface focus:ring-primary',
//         ghost: 'hover:bg-surface',
//         link: 'bg-transparent underline-offset-4 hover:underline text-primary p-0 h-auto', // nueva variante "link"
//       },
//       size: {
//         default: 'h-10 py-2 px-4',
//         sm: 'h-9 px-3',
//         lg: 'h-11 px-8 text-base',
//         icon: 'h-10 w-10',
//       },
//     },
//     defaultVariants: {
//       variant: 'default',
//       size: 'default',
//     },
//   }
// );

// export interface ButtonProps
//   extends React.ButtonHTMLAttributes<HTMLButtonElement>,
//     VariantProps<typeof buttonVariants> {
//   /**
//    * Si `asChild` es true, el componente renderizará un <Slot />
//    * para permitir pasar componentes hijos como <Link> o <a>.
//    */
//   asChild?: boolean;
// }

// /**
//  * Nota: usamos forwardRef con tipo `any` para mantener compatibilidad
//  * cuando se usa `asChild` (Slot puede recibir varios tipos de elementos).
//  * Si quieres tiparlo más estrictamente, podemos ajustar según tus needs.
//  */
// const Button = React.forwardRef<any, ButtonProps>(
//   ({ className, variant, size, asChild = false, ...props }, ref) => {
//     const Comp: any = asChild ? Slot : 'button';
//     return (
//       <Comp
//         ref={ref}
//         className={twMerge(buttonVariants({ variant, size }), className)}
//         {...props}
//       />
//     );
//   }
// );

// Button.displayName = 'Button';

// export { Button, buttonVariants };
// export default Button;
// components/ui/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90 focus:ring-primary',
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
        outline: 'border border-border bg-transparent hover:bg-surface focus:ring-primary',
        ghost: 'hover:bg-surface',
        link: 'bg-transparent underline-offset-4 hover:underline text-primary p-0 h-auto',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
}

/**
 * Button soporta:
 * - variant, size (desde cva)
 * - asChild: cuando true, se clona el único hijo (p. ej. <Link>) y se le aplican clases/props
 * - leftIcon / rightIcon: se insertan dentro del elemento final
 */
const Button = React.forwardRef<HTMLButtonElement | HTMLElement, ButtonProps>(
  ({ className, variant, size, asChild = false, leftIcon, rightIcon, children, ...props }, ref) => {
    const mergedClassName = twMerge(buttonVariants({ variant, size }), className);

    // Si no usamos asChild: renderizamos un <button> normal
    if (!asChild) {
      return (
        <button ref={ref as React.Ref<HTMLButtonElement>} className={mergedClassName} {...(props as any)}>
          {leftIcon && <span className="mr-2 -ml-1 flex items-center">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2 flex items-center">{rightIcon}</span>}
        </button>
      );
    }

    // asChild = true -> clonamos el único hijo recibido y le inyectamos clases/props y los iconos
    // React.Children.only lanzará un error si no hay EXACTAMENTE UN hijo (es intencional)
    const child = React.Children.only(children) as React.ReactElement;

    // Combina las classNames (el hijo puede tener su propia className)
    const childClassName = twMerge(mergedClassName, (child.props && child.props.className) || '');

    // Construimos los nuevos children: icono izq + children originales del child + icono der
    const newChildChildren = (
      <>
        {leftIcon && <span className="mr-2 -ml-1 flex items-center">{leftIcon}</span>}
        {child.props && child.props.children}
        {rightIcon && <span className="ml-2 flex items-center">{rightIcon}</span>}
      </>
    );

    // Clonamos el elemento y le inyectamos className, ref y props (onClick, etc.)
    return React.cloneElement(child, {
      ...props,
      ref,
      className: childClassName,
      children: newChildChildren,
    });
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
