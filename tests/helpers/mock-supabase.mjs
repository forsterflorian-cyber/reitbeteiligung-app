function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyFilters(rows, filters) {
  return rows.filter((row) => filters.every((filter) => row?.[filter.column] === filter.value));
}

class QueryBuilder {
  constructor(table, mode, state, payload = null) {
    this.table = table;
    this.mode = mode;
    this.payload = payload;
    this.state = state;
    this.filters = [];
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.#executeSingle());
  }

  then(resolve, reject) {
    return Promise.resolve(this.#executeMany()).then(resolve, reject);
  }

  #executeMany() {
    const rows = this.state.tables[this.table] ?? [];

    if (this.mode === "delete") {
      const remainingRows = [];
      const deletedRows = [];

      for (const row of rows) {
        if (applyFilters([row], this.filters).length > 0) {
          deletedRows.push(row);
        } else {
          remainingRows.push(row);
        }
      }

      this.state.tables[this.table] = remainingRows;
      return { data: clone(deletedRows), error: null };
    }

    if (this.mode === "update") {
      const updatedRows = [];
      this.state.tables[this.table] = rows.map((row) => {
        if (applyFilters([row], this.filters).length === 0) {
          return row;
        }

        const updatedRow = { ...row, ...clone(this.payload) };
        updatedRows.push(updatedRow);
        return updatedRow;
      });

      return { data: clone(updatedRows), error: null };
    }

    return { data: clone(applyFilters(rows, this.filters)), error: null };
  }

  #executeSingle() {
    const result = this.#executeMany();
    return {
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error
    };
  }
}

export function createSupabaseMock(seed = {}, options = {}) {
  const state = {
    rpcCalls: [],
    tables: Object.fromEntries(Object.entries(seed).map(([table, rows]) => [table, clone(rows)]))
  };

  return {
    state,
    from(table) {
      if (!state.tables[table]) {
        state.tables[table] = [];
      }

      return {
        delete() {
          return new QueryBuilder(table, "delete", state);
        },
        update(payload) {
          return new QueryBuilder(table, "update", state, payload);
        },
        select() {
          return new QueryBuilder(table, "select", state);
        },
        upsert(payload, upsertOptions = {}) {
          const rows = state.tables[table];
          const items = Array.isArray(payload) ? payload : [payload];
          const conflictColumns = (upsertOptions.onConflict ?? "id")
            .split(",")
            .map((column) => column.trim())
            .filter(Boolean);

          for (const item of items) {
            const itemClone = clone(item);
            const existingIndex = rows.findIndex((row) => conflictColumns.every((column) => row?.[column] === itemClone[column]));

            if (existingIndex >= 0) {
              rows[existingIndex] = { ...rows[existingIndex], ...itemClone };
            } else {
              rows.push(itemClone);
            }
          }

          return Promise.resolve({ data: null, error: null });
        }
      };
    },
    rpc(name, args) {
      state.rpcCalls.push({ args: clone(args), name });
      const handler = options.rpcHandlers?.[name];

      if (!handler) {
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve(handler({ args: clone(args), state }));
    }
  };
}
