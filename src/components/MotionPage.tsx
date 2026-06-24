import { motion, type HTMLMotionProps } from "framer-motion";

/**
 * Wrapper to animate the entry of a full page route.
 * Use as the outermost element returned by a route component.
 */
export function MotionPage({ children, className, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
