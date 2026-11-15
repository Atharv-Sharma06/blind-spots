"use client";

import { keepPreviousData, useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { api, isApiError, type ApiError } from "@/lib/api";
import type {
  ApiExperiment,
  ApiObservation,
  ApiResponse,
  AssessRequest,
  AssessResponse,
  BriefRequest,
  BriefResponse,
  CompareRequest,
  CompareResponse,
  ContextResponse,
  CounterfactualRequest,
  CounterfactualResponse,
  CoverageResponse,
  ExperimentDetail,
  ExperimentsQuery,
  GridQuery,
  GroupSummary,
  Investigation,
  MethodologyResponse,
  ModelMetadata,
  PredictRequest,
  PredictResponse,
  RankRequest,
  RankResponse,
  SourcesResponse,
  SurfaceResponse,
  TargetsResponse,
  ValidationResponse,
} from "@/lib/types";
import { queryKeys } from "./keys";

/** Result of every data hook: `data` is `{ data, meta }` (meta.source = "live" | "snapshot"). */
export type ApiQuery<T> = UseQueryResult<ApiResponse<T>, ApiError>;

/** Answers that will not change are not retried (the provider default also retries transient errors once). */
const NO_RETRY = new Set(["not_found", "validation_error", "artifact_missing"]);
const retry = (count: number, error: Error) =>
  isApiError(error) && (NO_RETRY.has(error.code) || error.snapshotUnavailable) ? false : count < 1;

/** useQuery with the error type pinned to ApiError. */
function useApiQuery<T>(options: UseQueryOptions<ApiResponse<T>, ApiError>): ApiQuery<T> {
  return useQuery<ApiResponse<T>, ApiError>(options);
}

// ---- Plain GET endpoints ---------------------------------------------------------------------------

export const useInvestigations = (): ApiQuery<Investigation[]> =>
  useApiQuery({ queryKey: queryKeys.investigations(), queryFn: ({ signal }) => api.investigations(signal), retry });

export const useGroups = (): ApiQuery<GroupSummary[]> =>
  useApiQuery({ queryKey: queryKeys.groups(), queryFn: ({ signal }) => api.groups(signal), retry });

export const useExperiments = (query?: ExperimentsQuery): ApiQuery<ApiExperiment[]> =>
  useApiQuery({
    queryKey: queryKeys.experiments(query),
    queryFn: ({ signal }) => api.experiments(query, signal),
    placeholderData: keepPreviousData,
    retry,
  });

export const useExperiment = (id: string | null | undefined): ApiQuery<ExperimentDetail> =>
  useApiQuery({
    queryKey: queryKeys.experiment(id ?? ""),
    queryFn: ({ signal }) => api.experiment(id as string, signal),
    enabled: !!id,
    retry,
  });

export const useObservations = (group: string | null | undefined): ApiQuery<ApiObservation[]> =>
  useApiQuery({
    queryKey: queryKeys.observations(group),
    queryFn: ({ signal }) => api.observations(group, signal),
    enabled: !!group,
    placeholderData: keepPreviousData,
    retry,
  });

export const useTargets = (): ApiQuery<TargetsResponse> =>
  useApiQuery({ queryKey: queryKeys.targets(), queryFn: ({ signal }) => api.targets(signal), retry });

/** GET /api/context (not-integrated investigations, ground flammability, context experiments). */
export const useContextEvidence = (): ApiQuery<ContextResponse> =>
  useApiQuery({ queryKey: queryKeys.context(), queryFn: ({ signal }) => api.context(signal), retry });

export const useModelMetadata = (group: string | null | undefined): ApiQuery<ModelMetadata> =>
  useApiQuery({
    queryKey: queryKeys.modelMetadata(group),
    queryFn: ({ signal }) => api.modelMetadata(group, signal),
    enabled: !!group,
    retry,
  });

export const useValidation = (): ApiQuery<ValidationResponse> =>
  useApiQuery({ queryKey: queryKeys.validation(), queryFn: ({ signal }) => api.validation(signal), retry });

export const useMethodology = (): ApiQuery<MethodologyResponse> =>
  useApiQuery({ queryKey: queryKeys.methodology(), queryFn: ({ signal }) => api.methodology(signal), retry });

export const useSources = (): ApiQuery<SourcesResponse> =>
  useApiQuery({ queryKey: queryKeys.sources(), queryFn: ({ signal }) => api.sources(signal), retry });

// ---- Grids (placeholderData keeps the previous grid while the slice / group changes) --------------------

export const useCoverage = (query: GridQuery | null | undefined, opts: { enabled?: boolean } = {}): ApiQuery<CoverageResponse> =>
  useApiQuery({
    queryKey: queryKeys.coverage(query),
    queryFn: ({ signal }) => api.coverage(query as GridQuery, signal),
    enabled: !!query?.group && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    retry,
  });

export const useSurface = (query: GridQuery | null | undefined, opts: { enabled?: boolean } = {}): ApiQuery<SurfaceResponse> =>
  useApiQuery({
    queryKey: queryKeys.surface(query),
    queryFn: ({ signal }) => api.surface(query as GridQuery, signal),
    enabled: !!query?.group && (opts.enabled ?? true),
    placeholderData: keepPreviousData,
    retry,
  });

// ---- POST endpoints as queries (null request = disabled; keyed by canonical JSON body) -----------------

export const usePredict = (body: PredictRequest | null | undefined): ApiQuery<PredictResponse> =>
  useApiQuery({
    queryKey: queryKeys.predict(body),
    queryFn: ({ signal }) => api.predict(body as PredictRequest, signal),
    enabled: !!body && body.points.length > 0,
    placeholderData: keepPreviousData,
    retry,
  });

export const useAssessTarget = (body: AssessRequest | null | undefined): ApiQuery<AssessResponse> =>
  useApiQuery({
    queryKey: queryKeys.assess(body),
    queryFn: ({ signal }) => api.assessTarget(body as AssessRequest, signal),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry,
  });

export const useRankCandidates = (body: RankRequest | null | undefined): ApiQuery<RankResponse> =>
  useApiQuery({
    queryKey: queryKeys.rank(body),
    queryFn: ({ signal }) => api.rankCandidates(body as RankRequest, signal),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry,
  });

export const useCompareCandidates = (body: CompareRequest | null | undefined): ApiQuery<CompareResponse> =>
  useApiQuery({
    queryKey: queryKeys.compare(body),
    queryFn: ({ signal }) => api.compareCandidates(body as CompareRequest, signal),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry,
  });

export const useCounterfactual = (body: CounterfactualRequest | null | undefined): ApiQuery<CounterfactualResponse> =>
  useApiQuery({
    queryKey: queryKeys.counterfactual(body),
    queryFn: ({ signal }) => api.counterfactual(body as CounterfactualRequest, signal),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry,
  });

export const useBrief = (body: BriefRequest | null | undefined): ApiQuery<BriefResponse> =>
  useApiQuery({
    queryKey: queryKeys.brief(body),
    queryFn: ({ signal }) => api.brief(body as BriefRequest, signal),
    enabled: !!body,
    placeholderData: keepPreviousData,
    retry,
  });
