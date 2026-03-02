import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel } from '@ionic/react';
import { useState } from 'react';
import './Home.css';

interface HeaderInfo {
  fileName: string;
  contentLength: string | null;
  contentRange: string | null;
  status: number;
  requestRange: string;
  requestId: number;
  isValid: boolean;
  errorMessage?: string;
}

const Home: React.FC = () => {
  const [headerResults, setHeaderResults] = useState<HeaderInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const audioFiles = [
    'test-audio-1.wav',
    'test-audio-2.wav',
    'test-audio-3.wav',
    'test-audio-4.wav'
  ];

  const validateHeaders = (
    requestedRange: string,
    contentLength: string | null,
    contentRange: string | null,
    status: number
  ): { isValid: boolean; errorMessage?: string } => {
    // Parse requested range (e.g., "bytes=0-1023")
    const rangeMatch = requestedRange.match(/bytes=(\d+)-(\d+)/);
    if (!rangeMatch) {
      return { isValid: false, errorMessage: 'Invalid range format' };
    }

    const requestStart = parseInt(rangeMatch[1], 10);
    const requestEnd = parseInt(rangeMatch[2], 10);
    const expectedSize = requestEnd - requestStart + 1;

    // Check status code
    if (status !== 206) {
      return { isValid: false, errorMessage: `Expected status 206, got ${status}` };
    }

    // Check Content-Length
    if (!contentLength) {
      return { isValid: false, errorMessage: 'Content-Length header missing' };
    }

    const actualLength = parseInt(contentLength, 10);
    if (actualLength !== expectedSize) {
      return {
        isValid: false,
        errorMessage: `Content-Length mismatch: expected ${expectedSize}, got ${actualLength}`
      };
    }

    // Check Content-Range
    if (!contentRange) {
      return { isValid: false, errorMessage: 'Content-Range header missing' };
    }

    const rangePattern = /bytes (\d+)-(\d+)\/\d+/;
    const contentRangeMatch = contentRange.match(rangePattern);
    if (!contentRangeMatch) {
      return { isValid: false, errorMessage: `Invalid Content-Range format: ${contentRange}` };
    }

    const responseStart = parseInt(contentRangeMatch[1], 10);
    const responseEnd = parseInt(contentRangeMatch[2], 10);

    if (responseStart !== requestStart || responseEnd !== requestEnd) {
      return {
        isValid: false,
        errorMessage: `Range mismatch: requested ${requestStart}-${requestEnd}, got ${responseStart}-${responseEnd}`
      };
    }

    return { isValid: true };
  };

  const testSingleAudio = async (fileName: string): Promise<void> => {
    setLoading(true);
    setHeaderResults([]);

    const url = `/test-assets/${fileName}`;

    try {
      console.log(`\n=== Testing ${fileName} ===`);

      const response = await fetch(url, {
        headers: {
          'range': 'bytes=0-1023'
        }
      });

      const contentLength = response.headers.get('Content-Length');
      const contentRange = response.headers.get('Content-Range');
      const status = response.status;

      const validation = validateHeaders('bytes=0-1023', contentLength, contentRange, status);

      const headerInfo: HeaderInfo = {
        fileName,
        contentLength,
        contentRange,
        status,
        requestRange: 'bytes=0-1023',
        requestId: 1,
        isValid: validation.isValid,
        errorMessage: validation.errorMessage
      };

      console.log('Status:', status);
      console.log('Content-Length:', contentLength);
      console.log('Content-Range:', contentRange);
      console.log('Validation:', validation);
      console.log('All headers:', Object.fromEntries(response.headers.entries()));

      setHeaderResults([headerInfo]);
    } catch (error) {
      console.error(`Error testing ${fileName}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const testAllAudioConcurrently = async (): Promise<void> => {
    setLoading(true);
    setHeaderResults([]);

    console.log('\n=== Testing All Audio Files Concurrently ===');

    const promises = audioFiles.map(async (fileName, index) => {
      const url = `/test-assets/${fileName}`;
      const rangeStart = index * (1024*16); // 16KB chunks
      const rangeEnd = rangeStart + (1024*16) - 1;
      const rangeHeader = `bytes=${rangeStart}-${rangeEnd}`;

      console.log(`\nRequest ${index + 1}: ${fileName} with Range: ${rangeHeader}`);

      const response = await fetch(url, {
        headers: {
          'range': rangeHeader
        }
      });

      const contentLength = response.headers.get('Content-Length');
      const contentRange = response.headers.get('Content-Range');
      const status = response.status;

      const validation = validateHeaders(rangeHeader, contentLength, contentRange, status);

      console.log(`Response ${index + 1}:`, {
        fileName,
        status,
        contentLength,
        contentRange,
        requestRange: rangeHeader,
        validation
      });

      return {
        fileName,
        contentLength,
        contentRange,
        status,
        requestRange: rangeHeader,
        requestId: index + 1,
        isValid: validation.isValid,
        errorMessage: validation.errorMessage
      };
    });

    try {
      const results = await Promise.all(promises);
      setHeaderResults(results);
      console.log('\n=== All Concurrent Requests Completed ===');
      const failures = results.filter((r) => !r.isValid);
      if (failures.length > 0) {
        console.error(`❌ ${failures.length} requests failed validation!`, failures);
      } else {
        console.log('✅ All requests passed validation');
      }
    } catch (error) {
      console.error('Error testing concurrent requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const stressTestSameFile = async (): Promise<void> => {
    setLoading(true);
    setHeaderResults([]);

    const fileName = 'test-audio-1.wav';
    const numRequests = 20;

    console.log(`\n=== Stress Test: ${numRequests} Concurrent Requests to ${fileName} ===`);

    const promises = Array.from({ length: numRequests }, async (_, index) => {
      const url = `/test-assets/${fileName}`;

      // Create different range requests to maximize header conflicts
      // Use varying sizes and positions
      const rangeSize = 1024 * (1 + (index % 5)); // 1KB to 5KB
      const rangeStart = index * 2048;
      const rangeEnd = rangeStart + rangeSize - 1;
      const rangeHeader = `bytes=${rangeStart}-${rangeEnd}`;

      console.log(`Request ${index + 1}: ${rangeHeader}`);

      const startTime = performance.now();
      const response = await fetch(url, {
        headers: {
          'range': rangeHeader
        }
      });
      const endTime = performance.now();

      const contentLength = response.headers.get('Content-Length');
      const contentRange = response.headers.get('Content-Range');
      const status = response.status;

      const validation = validateHeaders(rangeHeader, contentLength, contentRange, status);

      console.log(`Response ${index + 1} (${(endTime - startTime).toFixed(2)}ms):`, {
        status,
        contentLength,
        contentRange,
        requestRange: rangeHeader,
        validation,
        timing: `${(endTime - startTime).toFixed(2)}ms`
      });

      return {
        fileName,
        contentLength,
        contentRange,
        status,
        requestRange: rangeHeader,
        requestId: index + 1,
        isValid: validation.isValid,
        errorMessage: validation.errorMessage
      };
    });

    try {
      const results = await Promise.all(promises);
      setHeaderResults(results);

      const failures = results.filter((r) => !r.isValid);
      console.log('\n=== Stress Test Results ===');
      console.log(`Total requests: ${results.length}`);
      console.log(`Successful: ${results.length - failures.length}`);
      console.log(`Failed: ${failures.length}`);

      if (failures.length > 0) {
        console.error('❌ FAILED REQUESTS:', failures);
        console.error('\nThis indicates a race condition in header handling!');
      } else {
        console.log('✅ All requests passed validation');
      }
    } catch (error) {
      console.error('Error during stress test:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Range Request Header Test</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Range Request Test</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div style={{ padding: '16px' }}>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Test Controls</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <IonButton
                  expand="block"
                  onClick={() => testSingleAudio('test-audio-1.wav')}
                  disabled={loading}
                >
                  Test Single Audio (test-audio-1.wav)
                </IonButton>

                <IonButton
                  expand="block"
                  color="secondary"
                  onClick={testAllAudioConcurrently}
                  disabled={loading}
                >
                  Test All 4 Audio Files Concurrently
                </IonButton>

                <IonButton
                  expand="block"
                  color="danger"
                  onClick={stressTestSameFile}
                  disabled={loading}
                >
                  🔥 Stress Test: 20 Concurrent Requests (Same File)
                </IonButton>
              </div>

              <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
                <strong>Stress Test</strong> makes 20 concurrent requests with different byte ranges to the same file. This is most likely to expose the race condition bug.
              </p>
              <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                Check the console (DevTools) for detailed header information.
              </p>
            </IonCardContent>
          </IonCard>

          {headerResults.length > 0 && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>
                  Header Results ({headerResults.filter((r) => !r.isValid).length} failed)
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {headerResults.map((result, index) => (
                    <IonItem
                      key={index}
                      color={result.isValid ? undefined : 'danger'}
                    >
                      <IonLabel>
                        <h2>
                          {result.isValid ? '✅' : '❌'} {result.fileName} (Request #{result.requestId})
                        </h2>
                        <p><strong>Status:</strong> {result.status}</p>
                        <p><strong>Request Range:</strong> {result.requestRange}</p>
                        <p><strong>Content-Length:</strong> {result.contentLength || 'Not present'}</p>
                        <p><strong>Content-Range:</strong> {result.contentRange || 'Not present'}</p>
                        {!result.isValid && result.errorMessage && (
                          <p style={{ color: 'var(--ion-color-danger)', fontWeight: 'bold' }}>
                            ⚠️ {result.errorMessage}
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Audio Players</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {audioFiles.map((fileName) => (
                <div key={fileName} style={{ marginBottom: '16px' }}>
                  <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>{fileName}</p>
                  <audio
                    controls
                    style={{ width: '100%' }}
                    src={`/test-assets/${fileName}`}
                  />
                </div>
              ))}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
