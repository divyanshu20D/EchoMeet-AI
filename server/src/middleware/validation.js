import { z } from 'zod';

// Generic validation middleware factory
function validateSchema(schema, source = 'body') {
    return (req, res, next) => {
        try {
            let dataToValidate;

            switch (source) {
                case 'body':
                    dataToValidate = req.body;
                    break;
                case 'query':
                    dataToValidate = req.query;
                    break;
                case 'params':
                    dataToValidate = req.params;
                    break;
                default:
                    dataToValidate = req.body;
            }

            const validatedData = schema.parse(dataToValidate);

            // Replace the original data with validated data
            if (source === 'body') {
                req.body = validatedData;
            } else if (source === 'query') {
                req.query = validatedData;
            } else if (source === 'params') {
                req.params = validatedData;
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const validationErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code
                }));

                return res.status(400).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input data',
                        details: validationErrors,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Handle other types of errors
            return res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Validation processing error',
                    timestamp: new Date().toISOString()
                }
            });
        }
    };
}

// Common validation schemas
const commonSchemas = {
    // UUID parameter validation
    uuidParam: z.object({
        id: z.string().min(1, 'ID is required')
    }),

    // Pagination query validation
    pagination: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('desc')
    }),

    // Search query validation
    search: z.object({
        q: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
        page: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('1'),
        limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(50)).default('10')
    })
};

// Specific validation middleware functions
const validateBody = (schema) => validateSchema(schema, 'body');
const validateQuery = (schema) => validateSchema(schema, 'query');
const validateParams = (schema) => validateSchema(schema, 'params');

// Common validations
const validateUuidParam = validateParams(commonSchemas.uuidParam);
const validatePagination = validateQuery(commonSchemas.pagination);
const validateSearch = validateQuery(commonSchemas.search);

export {
    validateSchema,
    validateBody,
    validateQuery,
    validateParams,
    validateUuidParam,
    validatePagination,
    validateSearch,
    commonSchemas
};