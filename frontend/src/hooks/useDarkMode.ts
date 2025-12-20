import { useStore } from '../store/useStore';

export function useDarkMode() {
  const isDarkMode = useStore((state) => state.isDarkMode);
  const toggleDarkMode = useStore((state) => state.toggleDarkMode);

  return { isDarkMode, toggleDarkMode };
}













