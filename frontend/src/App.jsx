import Header from './components/layout/Header';
import './App.css';

/**
 * App shell — defines the fixed top-level layout:
 *   Header (always visible, draggable title bar)
 *   └── app-content (scrollable main area)
 *
 * When routing is added, replace the placeholder <main> content
 * with a <RouterProvider> or <Routes> block. The shell itself
 * never changes.
 */
function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-content">
        {/* Route pages will be rendered here */}
      </main>
    </div>
  );
}

export default App;
