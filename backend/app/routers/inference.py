from fastapi import APIRouter

router = APIRouter()


@router.post("/run")
def run_inference():
    """
    Run inference using a prompt and model configuration.
    
    Endpoint: POST /inference/run
    
    Request Body:
        - promptId: ID of the prompt to use
        - promptVersionId: Specific version of the prompt (optional, uses latest if not specified)
        - modelId: ID of the model to use
        - variableValues: Object with variable substitutions for prompt template
        - options: Inference options (temperature override, max tokens, etc.)
    
    Returns:
        Dictionary containing:
        - output: Generated text from the model
        - latencyMs: Response time in milliseconds
        - inputTokens: Number of input tokens used
        - outputTokens: Number of output tokens generated
        - totalTokens: Total tokens used
        - costEstimate: Estimated cost for the request
        - modelInfo: Information about the model used
    
    Behavior:
        - Validates that prompt and model belong to user's workspace
        - Interpolates prompt template with variable values
        - Makes API call to model provider
        - Records performance metrics and cost
        - Does not create experiment record (unlike /experiments endpoint)
        - Used for one-off inference without persistence
    """
    return {"message": "Not implemented yet"}
