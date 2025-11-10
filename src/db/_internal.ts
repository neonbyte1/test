export interface FindByIdClause {
  id: string;
}

export interface FindByNameClause {
  name: string;
}

export interface FindModelOptions<
  Clause,
  Relations extends object = Record<PropertyKey, unknown>,
> {
  where: Clause;
  relations?: Relations;
}

export interface FindAllModelsOptions<
  Relations extends object = Record<PropertyKey, unknown>,
> {
  offset?: number;
  limit?: number;
  relations?: Relations;
}
