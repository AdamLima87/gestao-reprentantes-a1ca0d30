import { motion } from "framer-motion";
import { TableRow } from "@/components/ui/table";

export const MotionTableRow = motion.create(TableRow);

export const rowMotionProps = (index: number) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.04, duration: 0.2 },
});
