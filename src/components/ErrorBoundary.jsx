import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Crystal Diwali app crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error-screen">
          <h1>Something went wrong</h1>
          <p>Please refresh the page and try again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
