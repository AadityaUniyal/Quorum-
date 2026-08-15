import logging

logger = logging.getLogger("googi_crawler.pagerank")

def compute_pagerank(
    link_graph: dict[str, list[str]],
    damping_factor: float = 0.85,
    max_iterations: int = 100,
    tolerance: float = 1e-6,
) -> dict[str, float]:
    """
    Computes PageRank authority score for nodes in a directed graph using power iteration.
    Guarantees convergence on all topologies including disconnected graphs via uniform teleportation.
    """
    all_pages = set(link_graph.keys())
    for targets in link_graph.values():
        for target in targets:
            all_pages.add(target)

    num_pages = len(all_pages)
    if num_pages == 0:
        return {}

    # Initialize uniform PageRank score
    ranks = {page: 1.0 / num_pages for page in all_pages}
    
    # Personalization vector (uniform 1/N teleportation)
    personalization = {page: 1.0 / num_pages for page in all_pages}

    # Pre-build in-links map
    in_links: dict[str, list[str]] = {page: [] for page in all_pages}
    out_degrees: dict[str, int] = {page: 0 for page in all_pages}

    for page, targets in link_graph.items():
        valid_targets = [t for t in targets if t in all_pages]
        out_degrees[page] = len(valid_targets)
        for target in valid_targets:
            in_links[target].append(page)

    # Power Iteration Loop
    diff = 0.0
    for iteration in range(1, max_iterations + 1):
        new_ranks = {}
        
        # Calculate dangling node PageRank contribution
        dangling_sum = sum(ranks[p] for p in all_pages if out_degrees[p] == 0)

        for page in all_pages:
            link_sum = 0.0
            for inbound in in_links[page]:
                link_sum += ranks[inbound] / out_degrees[inbound]
            
            # (1 - d) * p_i + d * (sum(PR(in)/deg(in)) + dangling_sum * p_i)
            new_ranks[page] = (1.0 - damping_factor) * personalization[page] + damping_factor * (
                link_sum + dangling_sum * personalization[page]
            )

        diff = sum(abs(new_ranks[page] - ranks[page]) for page in all_pages)
        ranks = new_ranks

        logger.debug(f"Iteration {iteration}: L1 diff = {diff:.8f}")
        if diff < tolerance:
            logger.info(f"PageRank converged after {iteration} iterations (L1 diff: {diff:.8f}).")
            break
    else:
        logger.warning(f"PageRank reached max iterations ({max_iterations}) without converging. Final diff: {diff:.8f}")
        if diff > 1e-4:
            logger.error(f"PageRank convergence assertion failed: final delta {diff:.8f} > 1e-4 after {max_iterations} iterations.")

    return ranks

