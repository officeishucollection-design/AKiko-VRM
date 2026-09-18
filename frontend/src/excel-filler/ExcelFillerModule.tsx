import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/common/Header';
import { Stepper } from './components/common/Stepper';
import { Step1CsvUpload } from './components/wizard/Step1CsvUpload';
import { Step2ExcelUpload } from './components/wizard/Step2ExcelUpload';
import { Step3MatchProducts } from './components/wizard/Step3MatchProducts';
import { Step4UrlAssignment } from './components/wizard/Step4UrlAssignment';
import { Step5FieldMapping } from './components/wizard/Step5FieldMapping';
import { Step6PreviewExtraction } from './components/wizard/Step6PreviewExtraction';
import { Step7ProcessAll } from './components/wizard/Step7ProcessAll';
import { Step8ReviewResults } from './components/wizard/Step8ReviewResults';
import { Step9ExportExcel } from './components/wizard/Step9ExportExcel';
import { DashboardView } from './components/views/DashboardView';
import { JobsHistoryView } from './components/views/JobsHistoryView';
import { UrlInspectorView } from './components/views/UrlInspectorView';
import {
  CsvData,
  ExcelInfo,
  FieldMapping,
  StandardField,
  Job,
  SkipRule,
} from './types';
import { api } from './services/api';
import { filterRowsBySkipRules } from './utils/filterUtils';

export function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'wizard' | 'jobs' | 'url-tools'>('wizard');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Wizard State
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [csvFilename, setCsvFilename] = useState<string>('');
  const [primaryKey, setPrimaryKey] = useState<string>('');
  const [skipRules, setSkipRules] = useState<SkipRule[]>([]);

  const [excelInfo, setExcelInfo] = useState<ExcelInfo | null>(null);
  const [excelFilename, setExcelFilename] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [primaryKeyMapping, setPrimaryKeyMapping] = useState<{
    csvKey: string;
    excelKey: string;
    mode: 'identifier' | 'row_order';
  }>({
    csvKey: '',
    excelKey: '',
    mode: 'row_order',
  });

  const [urlsMap, setUrlsMap] = useState<Record<string, string>>({});
  const [skipWebExtraction, setSkipWebExtraction] = useState<boolean>(false);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [customSelectors, setCustomSelectors] = useState<Record<string, string>>({});
  const [standardFields, setStandardFields] = useState<StandardField[]>([]);

  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // A job is an immutable processing/export snapshot. Changing any setup
  // input after it exists must require a new run; otherwise Step 8 can show
  // the current UI mapping while Step 9 exports the old job mapping.
  const invalidateActiveJob = () => setActiveJob(null);

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Compute dataset after applying row skip rules
  const effectiveCsvData = useMemo(() => {
    if (!csvData) return null;
    const filteredRows = filterRowsBySkipRules(csvData.rows, skipRules);
    return {
      ...csvData,
      rows: filteredRows,
      totalRows: filteredRows.length,
      preview: filteredRows.slice(0, 10),
      previewRows: filteredRows.slice(0, 10),
    };
  }, [csvData, skipRules]);

  // Load standard fields on mount
  useEffect(() => {
    api.getStandardFields().then(setStandardFields).catch(console.error);
  }, []);

  // Update maxStepReached
  const goToStep = (step: number) => {
    setCurrentStep(step);
    if (step > maxStepReached) {
      setMaxStepReached(step);
    }
  };

  // Load Preconfigured Demo Sample
  const handleLoadSample = async () => {
    setIsLoadingSample(true);
    try {
      const sample = await api.loadSmartphoneSample();
      setCsvData(sample.csv.data);
      setCsvFilename(sample.csv.filename);
      setPrimaryKey(sample.primaryKeyMapping.csvKey);
      setSkipRules([]);

      setExcelInfo(sample.excel.data);
      setExcelFilename(sample.excel.filename);
      setTemplateId(sample.excel.templateId);
      setSelectedSheet(sample.excel.data.defaultSheet || 'Master Product Catalog');

      setPrimaryKeyMapping(sample.primaryKeyMapping);
      setUrlsMap(sample.urlsMap);
      setSkipWebExtraction(false);
      setFieldMappings(sample.fieldMappings);

      // Create ready Job directly
      const products = sample.csv.data.rows.map((r: any) => ({
        id: String(r[sample.primaryKeyMapping.csvKey]),
        csvData: r,
        url: sample.urlsMap[String(r[sample.primaryKeyMapping.csvKey])] || '',
      }));

      const created = await api.createJob({
        csvData: sample.csv.data,
        templateId: sample.excel.templateId,
        sheetName: sample.excel.data.defaultSheet || 'Master Product Catalog',
        primaryKeyMapping: sample.primaryKeyMapping,
        fieldMappings: sample.fieldMappings,
        products,
        customSelectors: {},
        skipWebExtraction: false,
      });

      const fullJob = await api.getJob(created.jobId);
      setActiveJob(fullJob);

      setMaxStepReached(9);
      setCurrentTab('wizard');
      setCurrentStep(4); // Jump directly to URL screen or Step 1
    } catch (e) {
      console.error('Failed to load sample project', e);
      alert('Error loading demo sample.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Step 6 -> Step 7: Create background job before processing
  const handleProceedToProcess = async () => {
    const dataToUse = effectiveCsvData || csvData;
    if (!dataToUse) return;

    if (!activeJob) {
      const effectiveKey = primaryKeyMapping.csvKey || primaryKey;
      const headers = dataToUse.headers || [];
      const csvUrlCol = headers.find(h => {
        const l = h.toLowerCase().trim();
        return l === 'url' || l === 'product url' || l === 'product link' || l === 'link' ||
               l === 'webpage' || l === 'product_url' || l === 'product_link' || l === 'website' ||
               l === 'item url' || l === 'item link' || l === 'page url';
      }) || headers.find(h => {
        const l = h.toLowerCase().trim();
        return (l.includes('url') || l.includes('link') || l.includes('webpage')) && !l.includes('image') && !l.includes('photo');
      });

      const excelRows = currentSheetInfo?.existingRows || currentSheetInfo?.previewRows || currentSheetInfo?.sampleRows || excelInfo?.sheets?.[0]?.existingRows || [];
      const excelUrlCol = (currentSheetInfo?.headers || excelInfo?.sheets?.[0]?.headers || []).map(h => typeof h === 'string' ? h : h.header).find(h => {
        const l = String(h).toLowerCase().trim();
        return l.includes('url') || l.includes('link') || l.includes('webpage') || l.includes('website');
      });
      const excelKey = primaryKeyMapping.excelKey;

      const products = dataToUse.rows.map((r, idx) => {
        const id = String(r[effectiveKey] ?? r[primaryKey] ?? `PROD-${idx + 1}`);
        const urlFromMap = urlsMap[id] || (r[primaryKey] ? urlsMap[String(r[primaryKey])] : '') || (r[primaryKeyMapping.csvKey] ? urlsMap[String(r[primaryKeyMapping.csvKey])] : '');
        
        let urlFromExcel = '';
        let matchedExcelRow = null;
        if (excelRows.length > 0) {
          if (excelKey) {
            const searchVal = String(r[effectiveKey] ?? r[primaryKey] ?? '').trim().toLowerCase();
            matchedExcelRow = excelRows.find((er: any) => String(er[excelKey] || '').trim().toLowerCase() === searchVal);
          }
          if (!matchedExcelRow && excelRows[idx]) {
            matchedExcelRow = excelRows[idx];
          }
          if (matchedExcelRow && excelUrlCol && matchedExcelRow[excelUrlCol]) {
            urlFromExcel = String(matchedExcelRow[excelUrlCol]).trim();
          }
        }

        const urlFromCsv = csvUrlCol ? String(r[csvUrlCol] || '').trim() : '';
        const fallbackUrl = String(r['Product URL'] || r['URL'] || r['Product Link'] || r['Link'] || r['Webpage'] || '').trim();

        return {
          id,
          csvData: r,
          excelData: matchedExcelRow || {},
          url: urlFromMap || urlFromExcel || urlFromCsv || fallbackUrl || '',
        };
      });

      const created = await api.createJob({
        csvData: dataToUse,
        templateId,
        sheetName: selectedSheet,
        primaryKeyMapping,
        fieldMappings,
        products,
        customSelectors,
        skipWebExtraction,
      });

      const fullJob = await api.getJob(created.jobId);
      setActiveJob(fullJob);
    }

    goToStep(7);
  };

  const handleResetToNewJob = () => {
    setCsvData(null);
    setCsvFilename('');
    setPrimaryKey('');
    setSkipRules([]);
    setExcelInfo(null);
    setExcelFilename('');
    setTemplateId('');
    setSelectedSheet('');
    setUrlsMap({});
    setSkipWebExtraction(false);
    setFieldMappings([]);
    setCustomSelectors({});
    setActiveJob(null);
    setCurrentStep(1);
    setMaxStepReached(1);
    setCurrentTab('wizard');
  };

  const currentSheetInfo = excelInfo?.sheets.find(s => s.name === selectedSheet) || excelInfo?.sheets[0];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onLoadSample={handleLoadSample}
        isLoadingSample={isLoadingSample}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* TAB: Dashboard */}
        {currentTab === 'dashboard' && (
          <DashboardView
            onStartNewJob={() => {
              setCurrentTab('wizard');
              setCurrentStep(1);
            }}
            onLoadSample={handleLoadSample}
            isLoadingSample={isLoadingSample}
            onOpenUrlTools={() => setCurrentTab('url-tools')}
            onOpenJobsHistory={() => setCurrentTab('jobs')}
          />
        )}

        {/* TAB: Job History */}
        {currentTab === 'jobs' && (
          <JobsHistoryView
            onSelectJob={async (jobId) => {
              const j = await api.getJob(jobId);
              setActiveJob(j);
              setFieldMappings(j.fieldMappings);
              setCurrentTab('wizard');
              setCurrentStep(8); // Open directly in Review screen
            }}
            onStartNewJob={() => {
              handleResetToNewJob();
              setCurrentTab('wizard');
            }}
          />
        )}

        {/* TAB: URL Inspector Tool */}
        {currentTab === 'url-tools' && <UrlInspectorView />}

        {/* TAB: 9-Step Enrichment Wizard */}
        {currentTab === 'wizard' && (
          <div className="space-y-6">
            {/* Stepper Navigation */}
            <Stepper
              currentStep={currentStep}
              maxStepReached={maxStepReached}
              onStepClick={(step) => setCurrentStep(step)}
            />

            {/* Step 1: Upload CSV */}
            {currentStep === 1 && (
              <Step1CsvUpload
                csvData={csvData}
                csvFilename={csvFilename}
                primaryKey={primaryKey}
                skipRules={skipRules}
                onCsvLoaded={(data, filename, key) => {
                  setCsvData(data);
                  setCsvFilename(filename);
                  setPrimaryKey(key);
                  setPrimaryKeyMapping(prev => ({ ...prev, csvKey: key }));
                  invalidateActiveJob();
                }}
                onUpdateSkipRules={setSkipRules}
                onNext={() => goToStep(2)}
              />
            )}

            {/* Step 2: Upload Excel Template */}
            {currentStep === 2 && (
              <Step2ExcelUpload
                excelInfo={excelInfo}
                excelFilename={excelFilename}
                templateId={templateId}
                selectedSheet={selectedSheet}
                onExcelLoaded={(info, filename, tplId, sheetName) => {
                  setExcelInfo(info);
                  setExcelFilename(filename);
                  setTemplateId(tplId);
                  setSelectedSheet(sheetName);
                  setFieldMappings([]);
                  invalidateActiveJob();
                }}
                onSelectSheet={(sheetName) => {
                  setSelectedSheet(sheetName);
                  setFieldMappings([]);
                  invalidateActiveJob();
                }}
                onNext={() => goToStep(3)}
                onBack={() => setCurrentStep(1)}
              />
            )}

            {/* Step 3: Match Products */}
            {currentStep === 3 && (effectiveCsvData || csvData) && currentSheetInfo && (
              <Step3MatchProducts
                csvData={effectiveCsvData || csvData!}
                csvPrimaryKey={primaryKey}
                excelSheet={currentSheetInfo}
                primaryKeyMapping={primaryKeyMapping}
                onUpdateMapping={(mapping) => {
                  setPrimaryKeyMapping(mapping);
                  if (mapping.csvKey) setPrimaryKey(mapping.csvKey);
                  invalidateActiveJob();
                }}
                onNext={() => goToStep(4)}
                onBack={() => setCurrentStep(2)}
              />
            )}

            {/* Step 4: URL Assignment Hub */}
            {currentStep === 4 && (effectiveCsvData || csvData) && (
              <Step4UrlAssignment
                csvData={effectiveCsvData || csvData!}
                primaryKey={primaryKey}
                urlsMap={urlsMap}
                excelSheet={currentSheetInfo}
                primaryKeyMapping={primaryKeyMapping}
                skipWebExtraction={skipWebExtraction}
                onUpdateUrls={(urls) => {
                  setUrlsMap(urls);
                  invalidateActiveJob();
                }}
                onSetSkipWebExtraction={(skip) => {
                  setSkipWebExtraction(skip);
                  invalidateActiveJob();
                }}
                onNext={() => goToStep(5)}
                onBack={() => setCurrentStep(3)}
              />
            )}

            {/* Step 5: Configure Field Mapping */}
            {currentStep === 5 && (effectiveCsvData || csvData) && currentSheetInfo && (
              <Step5FieldMapping
                csvData={effectiveCsvData || csvData!}
                excelSheet={currentSheetInfo}
                fieldMappings={fieldMappings}
                customSelectors={customSelectors}
                standardFields={standardFields}
                skipWebExtraction={skipWebExtraction}
                onUpdateMappings={(mappings) => {
                  setFieldMappings(mappings);
                  invalidateActiveJob();
                }}
                onUpdateCustomSelectors={setCustomSelectors}
                onNext={() => goToStep(6)}
                onBack={() => setCurrentStep(4)}
              />
            )}

            {/* Step 6: Preview Webpage Extraction */}
            {currentStep === 6 && (effectiveCsvData || csvData) && (
              <Step6PreviewExtraction
                csvData={effectiveCsvData || csvData!}
                primaryKey={primaryKey}
                urlsMap={urlsMap}
                fieldMappings={fieldMappings}
                customSelectors={customSelectors}
                skipWebExtraction={skipWebExtraction}
                onToggleSkipWebExtraction={setSkipWebExtraction}
                onNext={handleProceedToProcess}
                onBack={() => setCurrentStep(5)}
              />
            )}

            {/* Step 7: Background Process All */}
            {currentStep === 7 && (
              <Step7ProcessAll
                job={activeJob}
                onJobUpdated={setActiveJob}
                onNext={() => goToStep(8)}
                onBack={() => setCurrentStep(6)}
              />
            )}

            {/* Step 8: Review Results & Resolve Conflicts */}
            {currentStep === 8 && activeJob && (
              <Step8ReviewResults
                job={activeJob}
                fieldMappings={activeJob.fieldMappings}
                onJobUpdated={setActiveJob}
                onNext={() => goToStep(9)}
                onBack={() => setCurrentStep(7)}
              />
            )}

            {/* Step 9: Populate Excel & Download */}
            {currentStep === 9 && activeJob && (
              <Step9ExportExcel
                job={activeJob}
                fieldMappings={activeJob.fieldMappings}
                excelFilename={excelFilename}
                onResetToNewJob={handleResetToNewJob}
                onBack={() => setCurrentStep(8)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
