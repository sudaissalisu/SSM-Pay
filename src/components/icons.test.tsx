import { render, screen } from '@testing-library/react';
import { Logo, SSMLogo } from './icons';

describe('Icons', () => {
  describe('Logo', () => {
    it('renders without crashing', () => {
      const { container } = render(<Logo />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders as SVG element', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
    });

    it('has correct default viewBox', () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('applies custom className prop', () => {
      const { container } = render(<Logo className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('forwards additional props to SVG element', () => {
      const { container } = render(<Logo data-testid="test-logo" width={50} height={50} />);
      const svg = container.querySelector('svg') as SVGSVGElement;
      expect(svg.getAttribute('data-testid')).toBe('test-logo');
      expect(svg.getAttribute('width')).toBe('50');
      expect(svg.getAttribute('height')).toBe('50');
    });

    it('contains expected path elements for Logo shape', () => {
      const { container } = render(<Logo />);
      const paths = container.querySelectorAll('path');
      // Logo should have 2 path elements
      expect(paths.length).toBe(2);
    });
  });

  describe('SSMLogo', () => {
    it('renders without crashing', () => {
      const { container } = render(<SSMLogo />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders as SVG element', () => {
      const { container } = render(<SSMLogo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
    });

    it('has correct default viewBox', () => {
      const { container } = render(<SSMLogo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('applies custom className prop', () => {
      const { container } = render(<SSMLogo className="text-primary size-8" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('text-primary');
      expect(svg).toHaveClass('size-8');
    });

    it('forwards aria-label for accessibility', () => {
      const { container } = render(<SSMLogo aria-label="SSM Logo" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-label', 'SSM Logo');
    });

    it('contains expected path elements for SSMLogo shape', () => {
      const { container } = render(<SSMLogo />);
      const paths = container.querySelectorAll('path');
      // SSMLogo should have multiple path elements for the SSM letter shapes
      expect(paths.length).toBeGreaterThan(5);
    });

    it('has stroke attributes set correctly', () => {
      const { container } = render(<SSMLogo />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('stroke-width', '2');
      expect(svg).toHaveAttribute('fill', 'none');
    });
  });

  describe('Icon variants comparison', () => {
    it('Logo and SSMLogo have different path structures', () => {
      const { container: logoContainer } = render(<Logo />);
      const { container: ssmContainer } = render(<SSMLogo />);

      const logoPaths = logoContainer.querySelectorAll('path');
      const ssmPaths = ssmContainer.querySelectorAll('path');

      // They should have different number of paths (different icons)
      expect(logoPaths.length).not.toBe(ssmPaths.length);
    });

    it('both icons support role prop for accessibility', () => {
      const { container: logoContainer } = render(<Logo role="img" />);
      const { container: ssmContainer } = render(<SSMLogo role="img" />);

      expect(logoContainer.querySelector('svg')?.getAttribute('role')).toBe('img');
      expect(ssmContainer.querySelector('svg')?.getAttribute('role')).toBe('img');
    });
  });
});
