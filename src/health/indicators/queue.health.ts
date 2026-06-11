import {
  Injectable,
} from "@nestjs/common";

import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";

@Injectable()
export class QueueHealthIndicator
  extends HealthIndicator {

  constructor() {
    super();
  }

  async isHealthy(
    key = "queue",
  ): Promise<HealthIndicatorResult> {
    try {
      // Queue health check - returns healthy by default
      return this.getStatus(
        key,
        true,
      );
    } catch {
      throw new HealthCheckError(
        "Queue check failed",
        this.getStatus(
          key,
          false,
        ),
      );
    }
  }
}
