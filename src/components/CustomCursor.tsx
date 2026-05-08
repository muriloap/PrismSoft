import { useEffect, useState, useCallback } from "react";

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [followerPosition, setFollowerPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
    setIsVisible(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);

  // Smooth follower animation
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      setFollowerPosition((prev) => ({
        x: prev.x + (position.x - prev.x) * 0.12,
        y: prev.y + (position.y - prev.y) * 0.12,
      }));
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [position]);

  // Detect hoverable elements
  useEffect(() => {
    const handleHoverDetection = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isHoverable =
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("a") ||
        target.closest("button") ||
        target.closest("[role='button']") ||
        target.classList.contains("cursor-pointer") ||
        getComputedStyle(target).cursor === "pointer";

      setIsHovering(!!isHoverable);
    };

    document.addEventListener("mouseover", handleHoverDetection);

    return () => {
      document.removeEventListener("mouseover", handleHoverDetection);
    };
  }, []);

  // Hide on touch devices
  const isTouchDevice =
    typeof window !== "undefined" && "ontouchstart" in window;

  if (isTouchDevice) {
    return null;
  }

  return (
    <>
      {/* Hide default cursor globally */}
      <style>{`
        * {
          cursor: none !important;
        }
      `}</style>

      {/* Main cursor dot - small dot that follows instantly */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          className="rounded-full bg-purple-400"
          style={{
            width: "6px",
            height: "6px",
          }}
        />
      </div>

      {/* Follower circle - thin border circle that follows with delay */}
      <div
        className="fixed pointer-events-none z-[9998]"
        style={{
          left: followerPosition.x,
          top: followerPosition.y,
          transform: "translate(-50%, -50%)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          className="rounded-full border border-purple-400/70 transition-all duration-300 ease-out"
          style={{
            width: isHovering ? "60px" : "40px",
            height: isHovering ? "60px" : "40px",
            backgroundColor: isHovering ? "rgba(168, 85, 247, 0.1)" : "transparent",
          }}
        />
      </div>
    </>
  );
};

export default CustomCursor;
